import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis/client'
import { emitStructuredError, emitStructuredInfo, emitStructuredWarn } from '@/lib/errors/structured-logger'

type GrafanaAlert = {
  status?: 'firing' | 'resolved' | string
  values?: Record<string, number | string | null | undefined>
  valueString?: string
  labels?: {
    alertname?: string
    [key: string]: string | undefined
  }
  annotations?: {
    summary?: string
    [key: string]: string | undefined
  }
}

type GrafanaWebhookPayload = {
  status?: 'firing' | 'resolved' | string
  values?: Record<string, number | string | null | undefined>
  valueString?: string
  alerts?: GrafanaAlert[]
  commonLabels?: {
    alertname?: string
    [key: string]: string | undefined
  }
  commonAnnotations?: {
    summary?: string
    [key: string]: string | undefined
  }
}

type LokiQueryResponse = {
  data?: {
    result?: Array<{
      values?: Array<[string, string]>
    }>
  }
}

type ParsedErrorLog = {
  error_type: string
  error_message: string
  error_id?: string
  stack: string
  endpoint: string
  timestamp?: string
  pathname?: string
  release?: string
  source?: string
}

const GRAFANA_DASHBOARD_URL = 'https://grafana.lebensordner.org/d/errors-dashboard'
const CONTEXT_TTL_SECONDS = 60 * 60 * 24

function nowInNanoseconds(): string {
  return (BigInt(Date.now()) * BigInt(1_000_000)).toString()
}

function minutesAgoInNanoseconds(minutes: number): string {
  return (BigInt(Date.now() - minutes * 60 * 1000) * BigInt(1_000_000)).toString()
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function lokiNsToIso(value: string): string | undefined {
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) {
    return undefined
  }
  const milliseconds = Math.floor(asNumber / 1_000_000)
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : undefined
}

function buildLokiQueryUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const searchParams = new URLSearchParams({
    query: '{container=~"lebensordner-app|lebensordner-worker"} | json | level="error"',
    limit: '5',
    direction: 'backward',
    start: minutesAgoInNanoseconds(5),
    end: nowInNanoseconds(),
  })
  return `${normalizedBaseUrl}/loki/api/v1/query_range?${searchParams.toString()}`
}

function toNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return undefined
}

function extractValueStringNumbers(valueString?: string): number[] {
  if (!valueString) {
    return []
  }

  const matches = [...valueString.matchAll(/value=([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g)]
  return matches
    .map((match) => toNonNegativeNumber(match[1]))
    .filter((value): value is number => value !== undefined)
}

function extractGrafanaAlertCount(payload: GrafanaWebhookPayload): number | undefined {
  const alertCandidates = (payload.alerts ?? [])
    .filter((alert) => alert.status !== 'resolved')
    .flatMap((alert) => {
      const fromValues = Object.values(alert.values ?? {})
        .map((value) => toNonNegativeNumber(value))
        .filter((value): value is number => value !== undefined)
      const fromValueString = extractValueStringNumbers(alert.valueString)
      const maxForAlert = Math.max(...fromValues, ...fromValueString)
      return Number.isFinite(maxForAlert) ? [maxForAlert] : []
    })

  if (alertCandidates.length > 0) {
    return Math.round(alertCandidates.reduce((sum, value) => sum + value, 0))
  }

  const payloadValues = Object.values(payload.values ?? {})
    .map((value) => toNonNegativeNumber(value))
    .filter((value): value is number => value !== undefined)
  const payloadValueStringValues = extractValueStringNumbers(payload.valueString)
  const maxPayloadValue = Math.max(...payloadValues, ...payloadValueStringValues)

  if (Number.isFinite(maxPayloadValue)) {
    return Math.round(maxPayloadValue)
  }

  return undefined
}

async function fetchLokiLogs(lokiBaseUrl?: string): Promise<ParsedErrorLog[]> {
  if (!lokiBaseUrl) {
    return []
  }

  try {
    const response = await fetch(buildLokiQueryUrl(lokiBaseUrl), {
      signal: AbortSignal.timeout(2000),
    })

    if (!response.ok) {
      throw new Error(`Loki query failed with status ${response.status}`)
    }

    const data = (await response.json()) as LokiQueryResponse
    const values = (data.data?.result ?? [])
      .flatMap((entry) => entry.values ?? [])
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .slice(0, 5)

    return values.map(([lokiTimestampNs, logLine]) => {
      try {
        const parsed = JSON.parse(logLine) as Record<string, unknown>
        const parsedMetadata = parsed.metadata
        const metadata =
          parsedMetadata && typeof parsedMetadata === 'object' && !Array.isArray(parsedMetadata)
            ? (parsedMetadata as Record<string, unknown>)
            : undefined
        const endpoint = asOptionalString(parsed.endpoint) ?? asOptionalString(parsed.queue) ?? ''
        const pathname = asOptionalString(metadata?.pathname) ?? asOptionalString(metadata?.href)
        return {
          error_type: String(parsed.error_type ?? 'unknown'),
          error_message: String(parsed.error_message ?? parsed.message ?? ''),
          error_id: typeof parsed.error_id === 'string' ? parsed.error_id : undefined,
          stack: String(parsed.stack ?? ''),
          endpoint,
          timestamp: asOptionalString(parsed.timestamp) ?? lokiNsToIso(lokiTimestampNs),
          pathname,
          release: asOptionalString(metadata?.release),
          source: asOptionalString(metadata?.source),
        }
      } catch {
        return {
          error_type: 'unknown',
          error_message: logLine,
          stack: '',
          endpoint: '',
          timestamp: lokiNsToIso(lokiTimestampNs),
        }
      }
    })
  } catch (error) {
    emitStructuredWarn({
      event_type: 'grafana_webhook',
      event_message: 'Loki query failed while enriching Grafana alert',
      endpoint: '/api/webhooks/grafana-alert',
      metadata: {
        reason: error instanceof Error ? error.message : 'unknown',
      },
    })
    return []
  }
}

function extractExamples(logs: ParsedErrorLog[], maxItems: number): string[] {
  const unique = new Set<string>()
  for (const log of logs) {
    const message = log.error_message.trim()
    if (!message) continue
    unique.add(message)
    if (unique.size >= maxItems) break
  }
  return [...unique]
}

function extractWindow(logs: ParsedErrorLog[]): { firstSeen?: string; lastSeen?: string } {
  const timestamps = logs
    .map((entry) => entry.timestamp)
    .filter((value): value is string => !!value)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))

  if (timestamps.length === 0) {
    return {}
  }

  const firstSeenMs = Math.min(...timestamps)
  const lastSeenMs = Math.max(...timestamps)
  return {
    firstSeen: new Date(firstSeenMs).toISOString(),
    lastSeen: new Date(lastSeenMs).toISOString(),
  }
}

function mostCommonErrorType(logs: ParsedErrorLog[]): string {
  if (logs.length === 0) {
    return 'unknown'
  }

  const counts = new Map<string, number>()
  for (const log of logs) {
    const key = log.error_type || 'unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  let winner = 'unknown'
  let winnerCount = -1
  for (const [key, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = key
      winnerCount = count
    }
  }
  return winner
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

async function sendTelegramMessage(payload: Record<string, unknown>): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    emitStructuredWarn({
      event_type: 'grafana_webhook',
      event_message: 'Telegram configuration missing for Grafana alert webhook',
      endpoint: '/api/webhooks/grafana-alert',
    })
    return
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, parse_mode: 'HTML', ...payload }),
      signal: AbortSignal.timeout(800),
    })

    if (!response.ok) {
      throw new Error(`Telegram API failed with status ${response.status}`)
    }
  } catch (error) {
    emitStructuredWarn({
      event_type: 'grafana_webhook',
      event_message: 'Telegram send failed for Grafana alert notification',
      endpoint: '/api/webhooks/grafana-alert',
      metadata: {
        reason: error instanceof Error ? error.message : 'unknown',
      },
    })
  }
}

export async function POST(req: Request) {
  const expectedSecret = process.env.GRAFANA_WEBHOOK_SECRET
  const urlSecret = new URL(req.url).searchParams.get('secret')
  const normalizedUrlSecret = urlSecret?.replace(/ /g, '+')
  const headerSecret = req.headers.get('X-Grafana-Webhook-Secret')
  const isAuthorized =
    !!expectedSecret &&
    ((!!headerSecret && headerSecret === expectedSecret) ||
      (!!normalizedUrlSecret && normalizedUrlSecret === expectedSecret))

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = (await req.json()) as GrafanaWebhookPayload
    const status = payload.status ?? 'firing'
    const alertSummary =
      payload.commonAnnotations?.summary ??
      payload.alerts?.[0]?.annotations?.summary ??
      'Error spike detected'
    const alertName =
      payload.commonLabels?.alertname ?? payload.alerts?.[0]?.labels?.alertname ?? 'Error Spike'
    const isDatasourceNoData =
      alertName.toLowerCase().includes('datasourcenodata') ||
      alertSummary.toLowerCase().includes('no data')
    const alertId = crypto.randomUUID()

    if (status === 'resolved') {
      emitStructuredInfo({
        event_type: 'grafana_webhook',
        event_message: `Grafana alert resolved: ${alertName}`,
        endpoint: '/api/webhooks/grafana-alert',
      })
      await sendTelegramMessage({
        text: `✅ <b>${escapeHtml(alertName)} resolved</b>`,
      })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // "DatasourceNoData" is not a concrete app failure context.
    // Avoid noisy issue prompts for this technical alert state.
    if (isDatasourceNoData) {
      emitStructuredInfo({
        event_type: 'grafana_webhook',
        event_message: `Grafana datasource no data state received: ${alertName}`,
        endpoint: '/api/webhooks/grafana-alert',
      })
      await sendTelegramMessage({
        text:
          `ℹ️ <b>${escapeHtml(alertName)}</b>\n\n` +
          `Grafana datasource returned no data for this evaluation window.\n` +
          `No fix issue was created because no concrete error context is available.`,
      })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const lokiLogs = await fetchLokiLogs(process.env.LOKI_INTERNAL_URL)
    const latest = lokiLogs[0]
    const errorType = mostCommonErrorType(lokiLogs)
    const errorMessage = latest?.error_message || alertSummary
    const endpoint = latest?.endpoint || ''
    const stack = latest?.stack || ''
    const pathname = latest?.pathname || ''
    const release = latest?.release || ''
    const source = latest?.source || ''
    const grafanaCount = extractGrafanaAlertCount(payload)
    const count = grafanaCount ?? lokiLogs.length
    const examples = extractExamples(lokiLogs, 3)
    const { firstSeen, lastSeen } = extractWindow(lokiLogs)

    const hasConcreteContext = count > 0 || lokiLogs.length > 0

    const alertContext = {
      alert_id: alertId,
      error_type: errorType,
      error_message: errorMessage,
      error_id: latest?.error_id,
      stack,
      endpoint,
      pathname,
      release,
      source,
      count,
      window_minutes: 5,
      timestamp: new Date().toISOString(),
      first_seen: firstSeen,
      last_seen: lastSeen,
      examples,
      grafana_url: GRAFANA_DASHBOARD_URL,
    }

    const redisTask = (async () => {
      if (!hasConcreteContext) return
      try {
        const redis = getRedis()
        await withTimeout(
          redis.set(`alert:context:${alertId}`, JSON.stringify(alertContext), 'EX', CONTEXT_TTL_SECONDS),
          500
        )
      } catch (error) {
        emitStructuredWarn({
          event_type: 'grafana_webhook',
          event_message: 'Redis context store failed for Grafana alert',
          endpoint: '/api/webhooks/grafana-alert',
          metadata: {
            alert_id: alertId,
            reason: error instanceof Error ? error.message : 'unknown',
          },
        })
      }
    })()

    const keyboard = hasConcreteContext
      ? [[
          { text: '📊 View in Grafana', url: GRAFANA_DASHBOARD_URL },
          { text: '🐛 Create Fix Issue', callback_data: `create_issue:${alertId}` },
        ]]
      : [[{ text: '📊 View in Grafana', url: GRAFANA_DASHBOARD_URL }]]

    const telegramTask = sendTelegramMessage({
      text:
        `🚨 <b>${escapeHtml(alertName)}</b>\n\n` +
        `<b>Count:</b> ${count} errors in 5 min\n` +
        `<b>Type:</b> ${escapeHtml(errorType)}\n` +
        `<b>Endpoint:</b> ${escapeHtml(endpoint || 'n/a')}\n` +
        `<b>Path:</b> ${escapeHtml(pathname || 'n/a')}\n` +
        `<b>Release:</b> ${escapeHtml(release || 'n/a')}\n\n` +
        `<code>${escapeHtml(errorMessage).slice(0, 350)}</code>` +
        (hasConcreteContext ? '' : '\n\nNo concrete error context was found for issue creation.'),
      reply_markup: {
        inline_keyboard: keyboard,
      },
    })

    await Promise.allSettled([redisTask, telegramTask])
  } catch (error) {
    emitStructuredError({
      error_type: 'grafana_webhook',
      error_message: 'Grafana alert webhook handler fallback path used',
      endpoint: '/api/webhooks/grafana-alert',
      stack: error instanceof Error ? error.stack : undefined,
      metadata: {
        reason: error instanceof Error ? error.message : 'unknown',
      },
    })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
