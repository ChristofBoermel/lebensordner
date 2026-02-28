import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis/client'

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
  stack: string
  endpoint: string
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

    return values.map(([, logLine]) => {
      try {
        const parsed = JSON.parse(logLine) as Record<string, unknown>
        return {
          error_type: String(parsed.error_type ?? 'unknown'),
          error_message: String(parsed.error_message ?? parsed.message ?? ''),
          stack: String(parsed.stack ?? ''),
          endpoint: String(parsed.endpoint ?? parsed.queue ?? ''),
        }
      } catch {
        return {
          error_type: 'unknown',
          error_message: logLine,
          stack: '',
          endpoint: '',
        }
      }
    })
  } catch (error) {
    console.warn('[GrafanaWebhook] Loki query failed:', error)
    return []
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
    console.warn('[GrafanaWebhook] Missing Telegram configuration')
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
    console.warn('[GrafanaWebhook] Telegram send failed:', error)
  }
}

export async function POST(req: Request) {
  const expectedSecret = process.env.GRAFANA_WEBHOOK_SECRET
  const urlSecret = new URL(req.url).searchParams.get('secret')
  const incomingSecret = req.headers.get('X-Grafana-Webhook-Secret') ?? urlSecret

  if (!expectedSecret || !incomingSecret || incomingSecret !== expectedSecret) {
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
    const alertId = crypto.randomUUID()

    if (status === 'resolved') {
      await sendTelegramMessage({
        text: `✅ <b>${escapeHtml(alertName)} resolved</b>`,
      })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const lokiLogs = await fetchLokiLogs(process.env.LOKI_INTERNAL_URL)
    const latest = lokiLogs[0]
    const errorType = mostCommonErrorType(lokiLogs)
    const errorMessage = latest?.error_message || alertSummary
    const endpoint = latest?.endpoint || ''
    const stack = latest?.stack || ''
    const grafanaCount = extractGrafanaAlertCount(payload)
    const count = grafanaCount ?? lokiLogs.length

    const alertContext = {
      alert_id: alertId,
      error_type: errorType,
      error_message: errorMessage,
      stack,
      endpoint,
      count,
      window_minutes: 5,
      timestamp: new Date().toISOString(),
      grafana_url: GRAFANA_DASHBOARD_URL,
    }

    const redisTask = (async () => {
      try {
        const redis = getRedis()
        await withTimeout(
          redis.set(`alert:context:${alertId}`, JSON.stringify(alertContext), 'EX', CONTEXT_TTL_SECONDS),
          500
        )
      } catch (error) {
        console.warn('[GrafanaWebhook] Redis context store failed:', error)
      }
    })()

    const telegramTask = sendTelegramMessage({
      text:
        `🚨 <b>${escapeHtml(alertName)}</b>\n\n` +
        `<b>Count:</b> ${count} errors in 5 min\n` +
        `<b>Type:</b> ${escapeHtml(errorType)}\n` +
        `<b>Endpoint:</b> ${escapeHtml(endpoint || 'n/a')}\n\n` +
        `<code>${escapeHtml(errorMessage).slice(0, 350)}</code>`,
      reply_markup: {
        inline_keyboard: [[
          { text: '📊 View in Grafana', url: GRAFANA_DASHBOARD_URL },
          { text: '🐛 Create Fix Issue', callback_data: `create_issue:${alertId}` },
        ]],
      },
    })

    await Promise.allSettled([redisTask, telegramTask])
  } catch (error) {
    console.warn('[GrafanaWebhook] Handler fallback path used:', error)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
