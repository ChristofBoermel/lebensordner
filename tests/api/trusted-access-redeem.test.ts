import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createServiceRoleSupabaseClientMock } = vi.hoisted(() => ({
  createServiceRoleSupabaseClientMock: vi.fn(),
}))

const { createServerSupabaseClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(() => Promise.resolve({})),
}))

const { resolveAuthenticatedUserMock } = vi.hoisted(() => ({
  resolveAuthenticatedUserMock: vi.fn(() => Promise.resolve(null)),
}))

const { emitStructuredErrorMock, emitStructuredWarnMock } = vi.hoisted(() => ({
  emitStructuredErrorMock: vi.fn(),
  emitStructuredWarnMock: vi.fn(),
}))

const {
  createTrustedAccessPendingCookieMock,
  emitTrustedAccessEventMock,
  hashTrustedAccessTokenMock,
} = vi.hoisted(() => ({
  createTrustedAccessPendingCookieMock: vi.fn(() => 'pending-cookie-value'),
  emitTrustedAccessEventMock: vi.fn(() => Promise.resolve()),
  hashTrustedAccessTokenMock: vi.fn(() => 'hashed-token-123'),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleSupabaseClient: createServiceRoleSupabaseClientMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/auth/resolve-authenticated-user', () => ({
  resolveAuthenticatedUser: resolveAuthenticatedUserMock,
}))

vi.mock('@/lib/errors/structured-logger', () => ({
  emitStructuredError: emitStructuredErrorMock,
  emitStructuredWarn: emitStructuredWarnMock,
}))

vi.mock('@/lib/security/trusted-access', () => ({
  createTrustedAccessPendingCookie: createTrustedAccessPendingCookieMock,
  emitTrustedAccessEvent: emitTrustedAccessEventMock,
  hashTrustedAccessToken: hashTrustedAccessTokenMock,
  TRUSTED_ACCESS_PENDING_COOKIE: 'trusted_access_pending',
}))

describe('Trusted access redeem API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('redirects unauthenticated users to the public login origin while preserving the token and pending cookie', async () => {
    const invitationRecord = {
      id: 'inv-1',
      owner_id: 'owner-1',
      trusted_person_id: 'tp-1',
      status: 'pending',
      claimed_at: null,
      expires_at: '2099-03-13T12:15:00.000Z',
      trusted_persons: {
        id: 'tp-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        relationship_status: 'setup_link_sent',
        is_active: true,
      },
    }

    const invitationChain = {
      select: vi.fn(() => invitationChain),
      eq: vi.fn(() => invitationChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: invitationRecord,
        error: null,
      }),
    }

    createServiceRoleSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => invitationChain),
    })

    const { GET } = await import('@/app/api/trusted-access/invitations/redeem/route')
    const response = await GET(
      new Request('http://0.0.0.0:3000/api/trusted-access/invitations/redeem?token=token-123', {
        headers: {
          'x-forwarded-host': 'lebensordner.org',
          'x-forwarded-proto': 'https',
        },
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://lebensordner.org/anmelden?next=%2Fzugriff%2Faccess%2Fredeem%3Ftoken%3Dtoken-123'
    )
    expect(response.cookies.get('trusted_access_pending')?.value).toBe('pending-cookie-value')
    expect(response.headers.get('set-cookie')).toContain('trusted_access_pending=pending-cookie-value')
  })
})
