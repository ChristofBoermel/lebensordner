import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
  })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'feedback-1' }, error: null })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60_000),
    available: true,
  })),
}))

vi.mock('@/lib/security/audit-log', () => ({
  logSecurityEvent: vi.fn(async () => ({ ok: true })),
}))

describe('/api/onboarding/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated POST requests', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await import('@/app/api/onboarding/feedback/route')
    const response = await POST(
      new Request('http://localhost/api/onboarding/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepName: 'welcome',
          clarityRating: 5,
        }),
      }),
    )

    const body = await response.json()
    expect(response.status).toBe(401)
    expect(body.error).toMatch(/nicht authentifiziert/i)
  })
})
