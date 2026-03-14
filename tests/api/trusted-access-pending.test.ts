import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createServiceRoleSupabaseClientMock } = vi.hoisted(() => ({
  createServiceRoleSupabaseClientMock: vi.fn(),
}))

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
    createTrustedAccessPendingCookieMock.mockReturnValue('pending-cookie-value')
    hashTrustedAccessTokenMock.mockReturnValue('hashed-token-123')
    readCookieValueFromHeaderMock.mockReturnValue(null)
    readTrustedAccessOtpCookieMock.mockReturnValue(null)
    readTrustedAccessPendingCookieMock.mockReturnValue(null)
    resolveAuthenticatedUserMock.mockResolvedValue({
      id: 'trusted-user-1',
      email: 'trusted@example.com',
    })
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
      otp_verified_at: null,
      trusted_persons: {
        id: 'tp-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        relationship_status: 'setup_link_sent',
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

    createServiceRoleSupabaseClientMock.mockReturnValue({
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
      relationshipStatus: 'setup_link_sent',
      expectedEmail: 'trusted@example.com',
      ownerName: 'Owner Example',
      otpVerified: false,
    })
    expect(response.cookies.get('trusted_access_pending')?.value).toBe('pending-cookie-value')
    expect(response.headers.get('set-cookie')).toContain('trusted_access_pending=pending-cookie-value')
  })

  it('falls back to the token when a stale pending cookie no longer resolves', async () => {
    readTrustedAccessPendingCookieMock.mockReturnValue({
      invitationId: 'stale-inv-1',
      ownerId: 'owner-1',
      trustedPersonId: 'tp-1',
      expectedEmail: 'trusted@example.com',
    })

    const freshInvitationRecord = {
      id: 'inv-1',
      owner_id: 'owner-1',
      trusted_person_id: 'tp-1',
      status: 'pending',
      expires_at: '2099-03-13T12:15:00.000Z',
      otp_verified_at: null,
      trusted_persons: {
        id: 'tp-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        relationship_status: 'setup_link_sent',
        is_active: true,
      },
      profiles: {
        full_name: 'Owner Example',
        email: 'owner@example.com',
      },
    }

    const invitationChain = {
      select: vi.fn(() => invitationChain),
      eq: vi.fn((column: string, value: string) => {
        if (column === 'id') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        if (column === 'token_hash' && value === 'hashed-token-123') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: freshInvitationRecord, error: null }),
          }
        }
        return {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
    }

    createServiceRoleSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => invitationChain),
    })

    const { GET } = await import('@/app/api/trusted-access/invitations/pending/route')
    const response = await GET(
      new Request('https://lebensordner.org/api/trusted-access/invitations/pending?token=token-123', {
        headers: { cookie: 'trusted_access_pending=stale-cookie' },
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'setup_required',
      relationshipStatus: 'setup_link_sent',
      expectedEmail: 'trusted@example.com',
    })
    expect(response.cookies.get('trusted_access_pending')?.value).toBe('pending-cookie-value')
  })


  it('falls back to the token when the pending cookie lookup errors but the token is still valid', async () => {
    readTrustedAccessPendingCookieMock.mockReturnValue({
      invitationId: 'not-a-real-uuid',
      ownerId: 'owner-1',
      trustedPersonId: 'tp-1',
      expectedEmail: 'trusted@example.com',
    })

    const freshInvitationRecord = {
      id: 'inv-1',
      owner_id: 'owner-1',
      trusted_person_id: 'tp-1',
      status: 'pending',
      expires_at: '2099-03-13T12:15:00.000Z',
      otp_verified_at: null,
      trusted_persons: {
        id: 'tp-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        relationship_status: 'setup_link_sent',
        is_active: true,
      },
      profiles: {
        full_name: 'Owner Example',
        email: 'owner@example.com',
      },
    }

    const invitationChain = {
      select: vi.fn(() => invitationChain),
      eq: vi.fn((column: string, value: string) => {
        if (column === 'id') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'invalid input syntax for type uuid: "not-a-real-uuid"' },
            }),
          }
        }
        if (column === 'token_hash' && value === 'hashed-token-123') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: freshInvitationRecord, error: null }),
          }
        }
        return {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
    }

    createServiceRoleSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => invitationChain),
    })

    const { GET } = await import('@/app/api/trusted-access/invitations/pending/route')
    const response = await GET(
      new Request('https://lebensordner.org/api/trusted-access/invitations/pending?token=token-123', {
        headers: { cookie: 'trusted_access_pending=broken-cookie' },
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'setup_required',
      relationshipStatus: 'setup_link_sent',
    })
    expect(emitStructuredErrorMock).not.toHaveBeenCalled()
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
