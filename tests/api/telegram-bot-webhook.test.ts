import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'

const redisGetMock = vi.fn()

vi.mock('@/lib/redis/client', () => ({
  getRedis: () => ({
    get: redisGetMock,
  }),
}))

function buildCallbackPayload(callbackData = 'create_issue:alert-id-123') {
  const callbackId = `callback-${Math.random().toString(36).slice(2, 10)}`

  return {
    update_id: 111,
    callback_query: {
      id: callbackId,
      data: callbackData,
      message: {
        message_id: 22,
        chat: { id: 12345 },
      },
    },
  }
}

describe('Telegram Bot Callback Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_WEBHOOK_SECRET = 'telegram-secret'
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token'
    process.env.GITHUB_PAT = 'github-pat'
    process.env.GITHUB_REPO = 'christofboermel/lebensordner'
    process.env.TELEGRAM_CHAT_ID = '12345'
    redisGetMock.mockResolvedValue(null)
  })

  it('returns 200 and ignores requests with invalid secret token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const { POST } = await import('@/app/api/webhooks/telegram-bot/route')

    const response = await POST(
      new Request('http://localhost/api/webhooks/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCallbackPayload()),
      })
    )

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(redisGetMock).not.toHaveBeenCalled()
  })

  it('answers callback, creates GitHub issue and confirms in Telegram', async () => {
    redisGetMock.mockResolvedValue(
      JSON.stringify({
        alert_id: 'alert-id-123',
        error_type: 'server',
        error_message: "TypeError: Cannot read properties of undefined (reading 'userId')",
        stack: 'TypeError: Cannot read properties of undefined\nat POST /api/documents/upload',
        endpoint: 'POST /api/documents/upload',
        count: 7,
        window_minutes: 5,
        timestamp: '2026-02-28T14:23:01Z',
        grafana_url: 'https://grafana.lebensordner.org/d/errors-dashboard',
      })
    )

    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ number: 42, html_url: 'https://github.com/christofboermel/lebensordner/issues/42' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/telegram-bot/route')
    const payload = buildCallbackPayload()
    const response = await POST(
      new Request('http://localhost/api/webhooks/telegram-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'telegram-secret',
        },
        body: JSON.stringify(payload),
      })
    )

    expect(response.status).toBe(200)
    await waitFor(() => {
      expect(redisGetMock).toHaveBeenCalledWith('alert:context:alert-id-123')
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    const answerCallBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(answerCallBody.callback_query_id).toBe(payload.callback_query.id)

    const githubCall = fetchMock.mock.calls[1]
    expect(String(githubCall[0])).toBe('https://api.github.com/repos/christofboermel/lebensordner/issues')
    const githubBody = JSON.parse(String(githubCall[1]?.body))
    expect(githubBody.title).toBe('[Error Spike] server — 7 errors in 5 min')
    expect(githubBody.labels).toEqual(['bug', 'auto-detected'])
    expect(githubBody.body).toContain('Suggested Traycer Prompt')
    expect(githubBody.body).toContain('POST /api/documents/upload')

    const confirmationBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body))
    expect(confirmationBody.text).toContain('Issue #42 created')
  })

  it('sends graceful fallback message when Redis context is missing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/telegram-bot/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/telegram-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'telegram-secret',
        },
        body: JSON.stringify(buildCallbackPayload()),
      })
    )

    expect(response.status).toBe(200)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    const fallbackBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(fallbackBody.text).toContain('Alert context expired or unavailable')
    expect(fallbackBody.text).toContain('grafana.lebensordner.org')
  })

  it('sends Telegram error message when GitHub issue creation fails', async () => {
    redisGetMock.mockResolvedValue(
      JSON.stringify({
        alert_id: 'alert-id-123',
        error_type: 'worker',
        error_message: 'Job failed',
        endpoint: 'email-queue',
        count: 4,
        window_minutes: 5,
        timestamp: '2026-02-28T14:30:00Z',
      })
    )

    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Resource not accessible by personal access token' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/telegram-bot/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/telegram-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'telegram-secret',
        },
        body: JSON.stringify(buildCallbackPayload()),
      })
    )

    expect(response.status).toBe(200)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
    const errorBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body))
    expect(errorBody.text).toContain('Could not create GitHub issue')
    expect(errorBody.text).toContain('Resource not accessible')
  })
})
