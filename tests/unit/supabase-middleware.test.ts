import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerClientMock, getUserMock, nextMock, redirectMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createServerClientMock: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    })),
  })),
  nextMock: vi.fn((init?: { request?: { headers?: Headers } }) => ({
    status: 200,
    headers: new Headers(),
    cookies: { set: vi.fn() },
    request: init?.request,
  })),
  redirectMock: vi.fn((url: URL) => ({
    status: 307,
    headers: new Headers({ location: url.toString() }),
    cookies: { set: vi.fn() },
  })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('next/server', () => ({
  NextResponse: {
    next: nextMock,
    redirect: redirectMock,
  },
}))

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows unauthenticated trusted-access redeem entrypoints', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const { updateSession } = await import('@/lib/supabase/middleware')
    const response = await updateSession({
      headers: new Headers(),
      cookies: { get: vi.fn(), set: vi.fn() },
      nextUrl: { pathname: '/zugriff/access/redeem' },
      url: 'https://lebensordner.org/zugriff/access/redeem?token=abc',
    } as any)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('still redirects other protected unauthenticated zugriff routes to login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const { updateSession } = await import('@/lib/supabase/middleware')
    const response = await updateSession({
      headers: new Headers(),
      cookies: { get: vi.fn(), set: vi.fn() },
      nextUrl: { pathname: '/zugriff' },
      url: 'https://lebensordner.org/zugriff',
    } as any)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://lebensordner.org/anmelden')
  })
})
