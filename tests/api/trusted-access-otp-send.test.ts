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

const { sendEmailWithTimeoutMock } = vi.hoisted(() => ({
  sendEmailWithTimeoutMock: vi.fn(() => Promise.resolve({ success: true, pendingInFlight: false })),
}))

const {
  buildTrustedAccessOtpExpiryMock,
  generateTrustedAccessOtpMock,
  hashTrustedAccessOtpMock,
  readCookieValueFromHeaderMock,
  readTrustedAccessPendingCookieMock,
} = vi.hoisted(() => ({
  buildTrustedAccessOtpExpiryMock: vi.fn(() => '2099-03-13T12:25:00.000Z'),
  generateTrustedAccessOtpMock: vi.fn(() => '123456'),
  hashTrustedAccessOtpMock: vi.fn(() => 'otp-hash'),
  readCookieValueFromHeaderMock: vi.fn(() => null),
  readTrustedAccessPendingCookieMock: vi.fn(() => ({
    invitationId: 'inv-1',
    ownerId: 'owner-1',
    trustedPersonId: 'tp-1',
    expectedEmail: 'trusted@example.com',
  })),
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

vi.mock('@/lib/email/resend-service', () => ({
  sendEmailWithTimeout: sendEmailWithTimeoutMock,
}))

vi.mock('@/lib/security/trusted-access', () => ({
  buildTrustedAccessOtpExpiry: buildTrustedAccessOtpExpiryMock,
  generateTrustedAccessOtp: generateTrustedAccessOtpMock,
  hashTrustedAccessOtp: hashTrustedAccessOtpMock,
  readCookieValueFromHeader: readCookieValueFromHeaderMock,
  readTrustedAccessPendingCookie: readTrustedAccessPendingCookieMock,
  TRUSTED_ACCESS_OTP_MAX_ATTEMPTS: 5,
  TRUSTED_ACCESS_PENDING_COOKIE: 'trusted_access_pending',
}))

function createAdminClient(options?: {
  ownerProfile?: { full_name: string | null; email: string | null } | null
  ownerProfileError?: any
}) {
  function createInvitationChain() {
    const invitationChain = {
      select: vi.fn(() => invitationChain),
      eq: vi.fn(() => invitationChain),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'inv-1',
          owner_id: 'owner-1',
          status: 'pending',
          expires_at: '2099-03-13T12:15:00.000Z',
          trusted_persons: {
            id: 'tp-1',
            user_id: 'owner-1',
            email: 'trusted@example.com',
            linked_user_id: 'trusted-user-1',
            invitation_status: 'accepted',
            relationship_status: 'setup_link_sent',
            is_active: true,
          },
        },
        error: null,
      })),
    }
    return invitationChain
  }

  function createOtpChallengeChain() {
    const deleteChain = {
      eq: vi.fn(() => deleteChain),
      is: vi.fn(async () => ({ error: null })),
    }

    return {
      delete: vi.fn(() => deleteChain),
      insert: vi.fn(async () => ({ error: null })),
    }
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
      if (table === 'trusted_access_otp_challenges') return createOtpChallengeChain()
      if (table === 'profiles') return createProfilesChain()
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

describe('Trusted access OTP send API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('continues with a fallback owner label when owner profile lookup fails', async () => {
    createServiceRoleSupabaseClientMock.mockReturnValue(
      createAdminClient({
        ownerProfileError: {
          code: 'PGRST200',
          message: 'relationship missing',
          details: null,
          hint: null,
        },
      })
    )

    const { POST } = await import('@/app/api/trusted-access/invitations/otp/send/route')
    const response = await POST(
      new Request('https://lebensordner.org/api/trusted-access/invitations/otp/send', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(sendEmailWithTimeoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Freigebender Lebensordner: Lebensordner'),
      })
    )
    expect(emitStructuredInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/trusted-access/invitations/otp/send',
        metadata: expect.objectContaining({
          operation: 'otp_owner_profile_lookup',
          invitationId: 'inv-1',
        }),
      })
    )
    expect(emitStructuredErrorMock).not.toHaveBeenCalled()
  })
})
