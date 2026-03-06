import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockResolveAuthenticatedUser = vi.fn()
const mockCheckRateLimit = vi.fn()
const mockInsert = vi.fn()
const mockEmailsSend = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({})),
}))

vi.mock('@/lib/auth/resolve-authenticated-user', () => ({
  resolveAuthenticatedUser: (...args: unknown[]) => mockResolveAuthenticatedUser(...args),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: (...args: unknown[]) => mockInsert(...args),
    })),
  })),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: (...args: unknown[]) => mockEmailsSend(...args),
    },
  })),
}))

describe('/api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60_000),
      available: true,
    })
  })

  it('rejects unauthenticated requests', async () => {
    mockResolveAuthenticatedUser.mockResolvedValue(null)

    const { POST } = await import('@/app/api/feedback/route')
    const response = await POST(
      new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          subject: 'Test',
          message: 'Hello',
          userId: 'spoofed-user-id',
        }),
      }),
    )

    expect(response.status).toBe(401)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('uses authenticated session user id instead of client-provided userId', async () => {
    mockResolveAuthenticatedUser.mockResolvedValue({ id: 'session-user-id' })
    mockInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 'feedback-1' }, error: null })),
      })),
    })
    mockEmailsSend.mockResolvedValue({ data: { id: 'msg-1' }, error: null })

    const { POST } = await import('@/app/api/feedback/route')
    const response = await POST(
      new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          subject: 'Test',
          message: 'Hello',
          userId: 'spoofed-user-id',
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'session-user-id',
      }),
    )
  })
})
