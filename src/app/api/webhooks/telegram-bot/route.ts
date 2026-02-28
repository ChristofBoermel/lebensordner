import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis/client'

type TelegramCallbackQuery = {
  id?: string
  data?: string
  message?: {
    chat?: {
      id?: number | string
    }
  }
}

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery
}

type AlertContext = {
  alert_id: string
  error_type: string
  error_message: string
  stack?: string
  endpoint?: string
  count: number
  window_minutes: number
  timestamp: string
  grafana_url?: string
}

type GitHubIssueResponse = {
  number?: number
  html_url?: string
  message?: string
}

const GRAFANA_DASHBOARD_URL = 'https://grafana.lebensordner.org/d/errors-dashboard'
const CREATE_ISSUE_PREFIX = 'create_issue:'
const CALLBACK_DEDUP_TTL_MS = 10 * 60 * 1000
const recentlyHandledCallbacks = new Map<string, number>()

function parseAlertId(callbackData?: string): string | null {
  if (!callbackData?.startsWith(CREATE_ISSUE_PREFIX)) {
    return null
  }

  const alertId = callbackData.slice(CREATE_ISSUE_PREFIX.length).trim()
  return alertId.length > 0 ? alertId : null
}

function clipText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

function clipStack(stack?: string): string {
  if (!stack?.trim()) {
    return 'No stack trace available'
  }

  return stack
    .split('\n')
    .slice(0, 12)
    .join('\n')
}

function markCallbackAsProcessing(callbackQueryId: string): boolean {
  const now = Date.now()

  for (const [id, expiresAt] of recentlyHandledCallbacks) {
    if (expiresAt <= now) {
      recentlyHandledCallbacks.delete(id)
    }
  }

  if (recentlyHandledCallbacks.has(callbackQueryId)) {
    return false
  }

  recentlyHandledCallbacks.set(callbackQueryId, now + CALLBACK_DEDUP_TTL_MS)
  return true
}

function buildIssueBody(context: AlertContext): string {
  const endpointOrQueue = context.endpoint?.trim() || 'n/a'
  const stackSnippet = clipStack(context.stack)
  const messageSnippet = clipText(context.error_message || 'No message', 500)
  const grafanaUrl = context.grafana_url || GRAFANA_DASHBOARD_URL
  const detectedAt = context.timestamp || new Date().toISOString()

  return [
    '## Error Summary',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Error type | ${context.error_type || 'unknown'} |`,
    `| Total errors | ${context.count} in the last ${context.window_minutes || 5} minutes |`,
    `| Endpoint / Queue | ${endpointOrQueue} |`,
    `| Detected at | ${detectedAt} |`,
    '',
    '## Most Recent Error',
    '',
    '```text',
    messageSnippet,
    stackSnippet,
    '```',
    '',
    '## Links',
    '',
    `- Grafana dashboard: ${grafanaUrl}`,
    '',
    '## Suggested Traycer Prompt',
    '',
    `Fix the ${context.error_type || 'application'} error occurring at ${endpointOrQueue}. ` +
      `The error is: "${clipText(context.error_message || 'Unknown error', 250)}". ` +
      `Investigate the root cause, implement a robust fix, and ensure existing tests still pass.`,
  ].join('\n')
}

async function postTelegramMethod(method: string, payload: Record<string, unknown>): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.warn('[TelegramBotWebhook] TELEGRAM_BOT_TOKEN is not configured')
    return
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3000),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Telegram ${method} failed: ${response.status} ${errorText}`.trim())
  }
}

async function sendTelegramMessage(chatId: number | string | undefined, text: string): Promise<void> {
  if (chatId === undefined || chatId === null) {
    console.warn('[TelegramBotWebhook] Chat id missing; cannot send Telegram message')
    return
  }

  await postTelegramMethod('sendMessage', { chat_id: chatId, text })
}

async function createGitHubIssue(context: AlertContext): Promise<{ number: number; url: string }> {
  const pat = process.env.GITHUB_PAT
  const repo = process.env.GITHUB_REPO

  if (!pat || !repo) {
    throw new Error('Missing GITHUB_PAT or GITHUB_REPO configuration')
  }

  const title = `[Error Spike] ${context.error_type || 'unknown'} — ${context.count} errors in 5 min`
  const body = buildIssueBody(context)

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title,
      body,
      labels: ['bug', 'auto-detected'],
    }),
    signal: AbortSignal.timeout(5000),
  })

  const responseJson = (await response.json().catch(() => ({}))) as GitHubIssueResponse

  if (!response.ok || !responseJson.number || !responseJson.html_url) {
    const details = responseJson.message || `GitHub API responded with ${response.status}`
    throw new Error(details)
  }

  return { number: responseJson.number, url: responseJson.html_url }
}

async function processCallbackInBackground(callbackQuery: TelegramCallbackQuery): Promise<void> {
  if (!callbackQuery.id) {
    return
  }

  const chatId = callbackQuery.message?.chat?.id ?? process.env.TELEGRAM_CHAT_ID
  const expiredContextMessage = `Alert context expired or unavailable. Please review and create manually: ${GRAFANA_DASHBOARD_URL}`

  try {
    await postTelegramMethod('answerCallbackQuery', { callback_query_id: callbackQuery.id })
  } catch (error) {
    console.warn('[TelegramBotWebhook] Failed to answer callback query:', error)
  }

  if (!markCallbackAsProcessing(callbackQuery.id)) {
    console.warn('[TelegramBotWebhook] Duplicate callback delivery ignored:', callbackQuery.id)
    return
  }

  const alertId = parseAlertId(callbackQuery.data)
  if (!alertId) {
    await sendTelegramMessage(chatId, 'Unsupported action payload. Please open Grafana and create an issue manually.')
    return
  }

  let context: AlertContext | null = null
  try {
    const redis = getRedis()
    const rawContext = await redis.get(`alert:context:${alertId}`)

    if (!rawContext) {
      await sendTelegramMessage(chatId, expiredContextMessage)
      return
    }

    context = JSON.parse(rawContext) as AlertContext
  } catch (error) {
    console.warn('[TelegramBotWebhook] Redis context retrieval failed:', error)
    await sendTelegramMessage(chatId, expiredContextMessage)
    return
  }

  try {
    const issue = await createGitHubIssue(context)
    await sendTelegramMessage(chatId, `✅ Issue #${issue.number} created - ${issue.url}`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error'
    await sendTelegramMessage(chatId, `❌ Could not create GitHub issue: ${clipText(reason, 250)}`)
  }
}

export async function POST(req: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const incomingSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')

  if (!expectedSecret || incomingSecret !== expectedSecret) {
    console.warn('[TelegramBotWebhook] Ignoring request with invalid secret token')
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
    const payload = (await req.json()) as TelegramUpdate
    const callbackQuery = payload.callback_query

    if (!callbackQuery?.id) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    void processCallbackInBackground(callbackQuery).catch((error) => {
      console.warn('[TelegramBotWebhook] Background processing failed:', error)
    })
  } catch (error) {
    console.warn('[TelegramBotWebhook] Fallback path used:', error)
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
