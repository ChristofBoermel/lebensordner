import { beforeEach, describe, expect, it, vi } from 'vitest'

const singleMock = vi.fn()
const checkRateLimitMock = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: (...args: unknown[]) => singleMock(...args),
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}))

describe('/api/download-link/[token]/challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: new Date(Date.now() + 60_000),
      available: true,
    })
  })

  it('rejects when recipient email does not match token recipient', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        recipient_email: 'invitee@example.com',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    })

    const { POST } = await import('@/app/api/download-link/[token]/challenge/route')
    const response = await POST(
      new Request('http://localhost/api/download-link/raw/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: 'attacker@example.com' }),
      }),
      { params: Promise.resolve({ token: 'raw' }) }
    )

    expect(response.status).toBe(403)
  })

  it('sets verification cookie on matching recipient email', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        recipient_email: 'invitee@example.com',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    })

    const { POST } = await import('@/app/api/download-link/[token]/challenge/route')
    const response = await POST(
      new Request('http://localhost/api/download-link/raw/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: 'invitee@example.com' }),
      }),
      { params: Promise.resolve({ token: 'raw' }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toContain('dlv_')
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly')
  })

  it('returns 429 when challenge rate limit is exceeded', async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
      available: true,
    })

    const { POST } = await import('@/app/api/download-link/[token]/challenge/route')
    const response = await POST(
      new Request('http://localhost/api/download-link/raw/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: 'invitee@example.com' }),
      }),
      { params: Promise.resolve({ token: 'raw' }) }
    )

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toMatch(/zu viele versuche/i)
  })
})
