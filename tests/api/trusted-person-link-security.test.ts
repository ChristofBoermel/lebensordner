import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockResolveAuthenticatedUser = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({
  update: vi.fn(() => ({
    ilike: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            select: (...args: unknown[]) => mockSelect(...args),
          })),
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}))

vi.mock('@/lib/auth/resolve-authenticated-user', () => ({
  resolveAuthenticatedUser: (...args: unknown[]) => mockResolveAuthenticatedUser(...args),
}))

describe('/api/trusted-person/link security hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 500 when user-scoped linking fails (no service-role fallback)', async () => {
    mockResolveAuthenticatedUser.mockResolvedValueOnce({
      id: 'user-1',
      email: 'invitee@example.com',
    })
    mockSelect.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    })

    const { POST } = await import('@/app/api/trusted-person/link/route')
    const response = await POST(
      new Request('http://localhost/api/trusted-person/link', { method: 'POST' }),
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toMatch(/verknüpfung derzeit nicht möglich/i)
  })

  it('links accepted invites by authenticated user email', async () => {
    mockResolveAuthenticatedUser.mockResolvedValueOnce({
      id: 'user-1',
      email: 'invitee@example.com',
    })
    mockSelect.mockResolvedValueOnce({
      data: [{ id: 'tp-1' }, { id: 'tp-2' }],
      error: null,
    })

    const { POST } = await import('@/app/api/trusted-person/link/route')
    const response = await POST(
      new Request('http://localhost/api/trusted-person/link', { method: 'POST' }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.linked).toBe(2)
  })
})
