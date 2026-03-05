import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckRateLimit = vi.fn()

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  incrementRateLimit: vi.fn(async () => undefined),
  RATE_LIMIT_2FA: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
      })),
    },
  })),
}))

describe('/api/auth/2fa route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 503 when rate limiter is unavailable', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      available: false,
    })

    const { POST } = await import('@/app/api/auth/2fa/route')

    const response = await POST(
      new Request('http://localhost/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      }),
    )

    const body = await response.json()
    expect(response.status).toBe(503)
    expect(body.error).toMatch(/temporarily unavailable/i)
  })
})
