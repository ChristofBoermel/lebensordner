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

const { emitStructuredErrorMock, emitStructuredInfoMock, emitStructuredWarnMock } = vi.hoisted(() => ({
  emitStructuredErrorMock: vi.fn(),
  emitStructuredInfoMock: vi.fn(),
  emitStructuredWarnMock: vi.fn(),
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
  emitStructuredInfo: emitStructuredInfoMock,
  emitStructuredWarn: emitStructuredWarnMock,
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

type InvitationRecord = {
  id: string
  owner_id: string
  trusted_person_id: string
  status: string
  expires_at: string
  otp_verified_at: string | null
  trusted_persons: {
    id: string
    user_id: string
    email: string
    linked_user_id: string | null
    invitation_status: string
    relationship_status: string
    is_active: boolean
  }
}

function createAdminClient(options?: {
  invitationById?: InvitationRecord | null
  invitationByToken?: InvitationRecord | null
  invitationByIdError?: any
  invitationByTokenError?: any
  ownerProfile?: { full_name: string | null; email: string | null } | null
  ownerProfileError?: any
}) {
  function createInvitationChain() {
    let filterColumn = ''
    let filterValue = ''

    const invitationChain = {
      select: vi.fn(() => invitationChain),
      eq: vi.fn((column: string, value: string) => {
        filterColumn = column
        filterValue = value
        return invitationChain
      }),
      maybeSingle: vi.fn(async () => {
        if (filterColumn === 'id') {
          return {
            data: options?.invitationById ?? null,
            error: options?.invitationByIdError ?? null,
          }
        }

        if (filterColumn === 'token_hash' && filterValue === 'hashed-token-123') {
          return {
            data: options?.invitationByToken ?? null,
            error: options?.invitationByTokenError ?? null,
          }
        }

        return { data: null, error: null }
      }),
    }

    return invitationChain
  }

  function createProfilesChain() {
    const profilesChain = {
      select: vi.fn(() => profilesChain),
      eq: vi.fn(() => profilesChain),
      maybeSingle: vi.fn(async () => ({
        data: options?.ownerProfile ?? null,
        error: options?.ownerProfileError ?? null,
      })),
    }

    return profilesChain
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'trusted_access_invitations') return createInvitationChain()
      if (table === 'profiles') return createProfilesChain()
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

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
        user_id: 'owner-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        relationship_status: 'setup_link_sent',
        is_active: true,
      },
    }

    createServiceRoleSupabaseClientMock.mockReturnValue(
      createAdminClient({
        invitationByToken: invitationRecord,
        ownerProfile: { full_name: 'Owner Example', email: 'owner@example.com' },
      })
    )

    const { GET } = await import('@/app/api/trusted-access/invitations/pending/route')
    const response = await GET(
      new Request('https://lebensordner.org/api/trusted-access/invitations/pending?token=token-123')
    )

    expect(hashTrustedAccessTokenMock).toHaveBeenCalledWith('token-123')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'setup_required',
      relationshipStatus: 'setup_link_sent',
      expectedEmail: 'trusted@example.com',
      ownerName: 'Owner Example',
      otpVerified: false,
    })
    expect(response.cookies.get('trusted_access_pending')?.value).toBe('pending-cookie-value')
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
        user_id: 'owner-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        relationship_status: 'setup_link_sent',
        is_active: true,
      },
    }

    createServiceRoleSupabaseClientMock.mockReturnValue(
      createAdminClient({
        invitationById: null,
        invitationByToken: freshInvitationRecord,
        ownerProfile: { full_name: 'Owner Example', email: 'owner@example.com' },
      })
    )

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

  it('falls back to a generic owner label when owner profile lookup fails', async () => {
    const invitationRecord = {
      id: 'inv-1',
      owner_id: 'owner-1',
      trusted_person_id: 'tp-1',
      status: 'pending',
      expires_at: '2099-03-13T12:15:00.000Z',
      otp_verified_at: null,
      trusted_persons: {
        id: 'tp-1',
        user_id: 'owner-1',
        email: 'trusted@example.com',
        linked_user_id: 'trusted-user-1',
        invitation_status: 'accepted',
        relationship_status: 'setup_link_sent',
        is_active: true,
      },
    }

    createServiceRoleSupabaseClientMock.mockReturnValue(
      createAdminClient({
        invitationByToken: invitationRecord,
        ownerProfileError: {
          code: 'PGRST200',
          message: 'relationship missing',
          details: null,
          hint: null,
        },
      })
    )

    const { GET } = await import('@/app/api/trusted-access/invitations/pending/route')
    const response = await GET(
      new Request('https://lebensordner.org/api/trusted-access/invitations/pending?token=token-123')
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'setup_required',
      ownerName: 'Lebensordner',
    })
    expect(emitStructuredInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/trusted-access/invitations/pending',
        metadata: expect.objectContaining({
          operation: 'pending_owner_profile_lookup',
          invitationId: 'inv-1',
        }),
      })
    )
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
