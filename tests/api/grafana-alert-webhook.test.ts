import { beforeEach, describe, expect, it, vi } from 'vitest'

const redisSetMock = vi.fn()

vi.mock('@/lib/redis/client', () => ({
  getRedis: () => ({
    set: redisSetMock,
  }),
}))

describe('Grafana Alert Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GRAFANA_WEBHOOK_SECRET = 'grafana-secret'
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token'
    process.env.TELEGRAM_CHAT_ID = '12345'
    process.env.LOKI_INTERNAL_URL = 'http://loki:3100'

    redisSetMock.mockResolvedValue('OK')
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('alert-id-123')
  })

  it('returns 401 when webhook secret is missing or invalid', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const { POST } = await import('@/app/api/webhooks/grafana-alert/route')

    const response = await POST(
      new Request('http://localhost/api/webhooks/grafana-alert', {
        method: 'POST',
        body: JSON.stringify({ status: 'firing' }),
      })
    )

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores context in Redis and sends Telegram inline keyboard for firing alerts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            result: [
              {
                values: [
                  [
                    '1700000000000000000',
                    JSON.stringify({
                      error_type: 'db_timeout',
                      error_message: 'Database timeout in query',
                      endpoint: '/api/profile',
                      stack: 'Error: timeout',
                    }),
                  ],
                ],
              },
            ],
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/grafana-alert/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/grafana-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grafana-Webhook-Secret': 'grafana-secret',
        },
        body: JSON.stringify({
          status: 'firing',
          commonLabels: { alertname: 'Error Spike' },
          commonAnnotations: { summary: 'High error rate' },
          alerts: [{ status: 'firing', values: { A: 27 } }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(redisSetMock).toHaveBeenCalledOnce()
    expect(redisSetMock).toHaveBeenCalledWith(
      'alert:context:alert-id-123',
      expect.stringContaining('"count":27'),
      'EX',
      86400
    )
    expect(redisSetMock).toHaveBeenCalledWith(
      'alert:context:alert-id-123',
      expect.stringContaining('"error_type":"db_timeout"'),
      'EX',
      86400
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const telegramCall = fetchMock.mock.calls[1]
    expect(String(telegramCall[0])).toContain('/bottelegram-token/sendMessage')

    const telegramBody = JSON.parse(String(telegramCall[1]?.body))
    expect(telegramBody.text).toContain('<b>Count:</b> 27 errors in 5 min')
    expect(telegramBody.reply_markup.inline_keyboard[0][0].url).toBe(
      'https://grafana.lebensordner.org/d/errors-dashboard'
    )
    expect(telegramBody.reply_markup.inline_keyboard[0][1].callback_data).toBe(
      'create_issue:alert-id-123'
    )
  })

  it('gracefully degrades when Loki is unavailable', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockRejectedValueOnce(new Error('Loki timeout'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/grafana-alert/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/grafana-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grafana-Webhook-Secret': 'grafana-secret',
        },
        body: JSON.stringify({
          status: 'firing',
          commonAnnotations: { summary: 'Fallback summary' },
          alerts: [{ status: 'firing' }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(redisSetMock).toHaveBeenCalledWith(
      'alert:context:alert-id-123',
      expect.stringContaining('"count":0'),
      'EX',
      86400
    )

    const telegramBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(telegramBody.text).toContain('Fallback summary')
  })

  it('uses a 5-minute Loki query range for context logs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { result: [] } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/grafana-alert/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/grafana-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grafana-Webhook-Secret': 'grafana-secret',
        },
        body: JSON.stringify({
          status: 'firing',
          alerts: [{ status: 'firing' }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const lokiCallUrl = new URL(String(fetchMock.mock.calls[0][0]))
    const start = BigInt(lokiCallUrl.searchParams.get('start') ?? '0')
    const end = BigInt(lokiCallUrl.searchParams.get('end') ?? '0')
    const diff = end - start

    expect(diff).toBeGreaterThanOrEqual(BigInt(299_000_000_000))
    expect(diff).toBeLessThanOrEqual(BigInt(301_000_000_000))
  })

  it('still returns 200 and sends Telegram when Redis fails', async () => {
    redisSetMock.mockRejectedValueOnce(new Error('Redis unavailable'))

    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { result: [] } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/grafana-alert/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/grafana-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grafana-Webhook-Secret': 'grafana-secret',
        },
        body: JSON.stringify({
          status: 'firing',
          commonAnnotations: { summary: 'Summary' },
          alerts: [{ status: 'firing' }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends a simple resolved message without inline keyboard', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as unknown as Response)

    const { POST } = await import('@/app/api/webhooks/grafana-alert/route')
    const response = await POST(
      new Request('http://localhost/api/webhooks/grafana-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grafana-Webhook-Secret': 'grafana-secret',
        },
        body: JSON.stringify({
          status: 'resolved',
          commonLabels: { alertname: 'Error Spike' },
          alerts: [{ status: 'resolved' }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(redisSetMock).not.toHaveBeenCalled()

    const telegramBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(telegramBody.text).toContain('resolved')
    expect(telegramBody.reply_markup).toBeUndefined()
  })

  it('returns 200 for malformed JSON payloads with valid auth header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const { POST } = await import('@/app/api/webhooks/grafana-alert/route')

    const response = await POST(
      new Request('http://localhost/api/webhooks/grafana-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grafana-Webhook-Secret': 'grafana-secret',
        },
        body: '{',
      })
    )

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(redisSetMock).not.toHaveBeenCalled()
  })
})
