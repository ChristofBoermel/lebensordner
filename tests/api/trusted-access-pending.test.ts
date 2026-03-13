import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerSupabaseClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(() => Promise.resolve({})),
}))

const { resolveAuthenticatedUserMock } = vi.hoisted(() => ({
  resolveAuthenticatedUserMock: vi.fn(() => Promise.resolve({
    id: 'trusted-user-1',
    email: 'trusted@example.com',
  })),
}))

const { emitStructuredErrorMock } = vi.hoisted(() => ({
  emitStructuredErrorMock: vi.fn(),
}))

const {
  createTrustedAccessPendingCookieMock,
  hashTrustedAccessTokenMock,
  readCookieValueFromHeaderMock,
  readTrustedAccessOtpCookieMock,
  readTrustedAccessPendingCookieMock,
} = vi.hoisted(() => ({
  createTrustedAccessPendingCookieMock: vi.fn(() => 'pending-cookie-value'),
  hashTrustedAccessTokenMock: vi.fn(() => 'hashed-token-123'),
  readCookieValueFromHeaderMock: vi.fn(() => null),
  readTrustedAccessOtpCookieMock: vi.fn(() => null),
  readTrustedAccessPendingCookieMock: vi.fn(() => null),
}))

const createClientMock = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/auth/resolve-authenticated-user', () => ({
  resolveAuthenticatedUser: resolveAuthenticatedUserMock,
}))

vi.mock('@/lib/errors/structured-logger', () => ({
  emitStructuredError: emitStructuredErrorMock,
}))

vi.mock('@/lib/security/trusted-access', () => ({
  createTrustedAccessPendingCookie: createTrustedAccessPendingCookieMock,
  hashTrustedAccessToken: hashTrustedAccessTokenMock,
  readCookieValueFromHeader: readCookieValueFromHeaderMock,
  readTrustedAccessOtpCookie: readTrustedAccessOtpCookieMock,
  readTrustedAccessPendingCookie: readTrustedAccessPendingCookieMock,
  TRUSTED_ACCESS_OTP_COOKIE: 'trusted_access_otp',
  TRUSTED_ACCESS_PENDING_COOKIE: 'trusted_access_pending',
}))

describe('Trusted access pending API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_URL = 'http://kong:8000'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('restores pending state from the invitation token when the pending cookie is missing', async () => {
    const invitationRecord = {
      id: 'inv-1',
      owner_id: 'owner-1',
      trusted_person_id: 'tp-1',
      status: 'pending',
      expires_at: '2099-03-13T12:15:00.000Z',
      trusted_persons: {
        id: 'tp-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        is_active: true,
      },
      profiles: {
        full_name: 'Owner Example',
        email: 'owner@example.com',
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

    createClientMock.mockReturnValue({
      from: vi.fn(() => invitationChain),
    })

    const { GET } = await import('@/app/api/trusted-access/invitations/pending/route')
    const response = await GET(
      new Request('https://lebensordner.org/api/trusted-access/invitations/pending?token=token-123')
    )

    expect(hashTrustedAccessTokenMock).toHaveBeenCalledWith('token-123')
    expect(invitationChain.eq).toHaveBeenCalledWith('token_hash', 'hashed-token-123')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'setup_required',
      expectedEmail: 'trusted@example.com',
      ownerName: 'Owner Example',
      otpVerified: false,
    })
    expect(response.cookies.get('trusted_access_pending')?.value).toBe('pending-cookie-value')
    expect(response.headers.get('set-cookie')).toContain('trusted_access_pending=pending-cookie-value')
  })

  it('returns expired when neither a pending cookie nor a token is available', async () => {
    const { GET } = await import('@/app/api/trusted-access/invitations/pending/route')
    const response = await GET(new Request('https://lebensordner.org/api/trusted-access/invitations/pending'))

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({
      status: 'expired_invitation',
      userMessageKey: 'secure_access_invitation_expired',
    })
  })
})
