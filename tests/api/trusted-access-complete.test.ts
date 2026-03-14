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
  createTrustedAccessDeviceCookieMock,
  decryptTrustedAccessBootstrapMock,
  emitTrustedAccessEventMock,
  hashTrustedAccessTokenMock,
  readCookieValueFromHeaderMock,
  readTrustedAccessOtpCookieMock,
  readTrustedAccessPendingCookieMock,
} = vi.hoisted(() => ({
  createTrustedAccessDeviceCookieMock: vi.fn(() => 'device-cookie-value'),
  decryptTrustedAccessBootstrapMock: vi.fn(() => 'a'.repeat(64)),
  emitTrustedAccessEventMock: vi.fn(() => Promise.resolve()),
  hashTrustedAccessTokenMock: vi.fn(() => 'device-secret-hash'),
  readCookieValueFromHeaderMock: vi.fn(() => null),
  readTrustedAccessOtpCookieMock: vi.fn(() => ({ invitationId: 'inv-1', userId: 'trusted-user-1' })),
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

vi.mock('@/lib/security/trusted-access', () => ({
  createTrustedAccessDeviceCookie: createTrustedAccessDeviceCookieMock,
  decryptTrustedAccessBootstrap: decryptTrustedAccessBootstrapMock,
  emitTrustedAccessEvent: emitTrustedAccessEventMock,
  hashTrustedAccessToken: hashTrustedAccessTokenMock,
  readCookieValueFromHeader: readCookieValueFromHeaderMock,
  readTrustedAccessOtpCookie: readTrustedAccessOtpCookieMock,
  readTrustedAccessPendingCookie: readTrustedAccessPendingCookieMock,
  TRUSTED_ACCESS_DEVICE_COOKIE: 'trusted_access_device',
  TRUSTED_ACCESS_OTP_COOKIE: 'trusted_access_otp',
  TRUSTED_ACCESS_PENDING_COOKIE: 'trusted_access_pending',
}))

function createAdminClient(options?: {
  ownerProfile?: { full_name: string | null; email: string | null } | null
  ownerProfileError?: any
}) {
  function createInvitationSelectChain() {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'inv-1',
          owner_id: 'owner-1',
          trusted_person_id: 'tp-1',
          status: 'pending',
          expires_at: '2099-03-13T12:15:00.000Z',
          metadata: {
            bootstrapRelationshipKey: 'encrypted-bootstrap',
          },
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
    return chain
  }

  function createDeviceInsertChain() {
    const chain = {
      insert: vi.fn(() => chain),
      select: vi.fn(() => chain),
      single: vi.fn(async () => ({ data: { id: 'device-1' }, error: null })),
    }
    return chain
  }

  function createUpdateChain() {
    return {
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }
  }

  function createProfilesChain() {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: options?.ownerProfile ?? null,
        error: options?.ownerProfileError ?? null,
      })),
    }
    return chain
  }

  let invitationsCall = 0
  return {
    from: vi.fn((table: string) => {
      if (table === 'trusted_access_invitations') {
        invitationsCall += 1
        if (invitationsCall === 1) return createInvitationSelectChain()
        return createUpdateChain()
      }
      if (table === 'trusted_access_devices') return createDeviceInsertChain()
      if (table === 'trusted_persons') return createUpdateChain()
      if (table === 'profiles') return createProfilesChain()
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

describe('Trusted access complete API', () => {
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

    const { POST } = await import('@/app/api/trusted-access/invitations/complete/route')
    const response = await POST(
      new Request('https://lebensordner.org/api/trusted-access/invitations/complete', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      ownerName: 'Lebensordner',
      ownerId: 'owner-1',
    })
    expect(emitStructuredInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/trusted-access/invitations/complete',
        metadata: expect.objectContaining({
          operation: 'complete_owner_profile_lookup',
          invitationId: 'inv-1',
        }),
      })
    )
    expect(emitStructuredErrorMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/trusted-access/invitations/complete',
        error_message: expect.stringContaining('relationship missing'),
      })
    )
  })
})
