import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createServiceRoleSupabaseClientMock } = vi.hoisted(() => ({
  createServiceRoleSupabaseClientMock: vi.fn(),
}))

const { createServerSupabaseClientMock } = vi.hoisted(() => ({
  createServerSupabaseClientMock: vi.fn(() => Promise.resolve({})),
}))

const { resolveAuthenticatedUserMock } = vi.hoisted(() => ({
  resolveAuthenticatedUserMock: vi.fn(() => Promise.resolve({ id: 'owner-1' })),
}))

const { emitStructuredErrorMock } = vi.hoisted(() => ({
  emitStructuredErrorMock: vi.fn(),
}))

const { buildTrustedAccessInvitationExpiryMock, encryptTrustedAccessBootstrapMock, generateTrustedAccessTokenMock, hashTrustedAccessTokenMock } = vi.hoisted(() => ({
  buildTrustedAccessInvitationExpiryMock: vi.fn(() => '2026-03-13T12:15:00.000Z'),
  encryptTrustedAccessBootstrapMock: vi.fn(() => 'encrypted-bootstrap'),
  generateTrustedAccessTokenMock: vi.fn(() => 'token-123'),
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
}))

vi.mock('@/lib/security/trusted-access', () => ({
  buildTrustedAccessInvitationExpiry: buildTrustedAccessInvitationExpiryMock,
  encryptTrustedAccessBootstrap: encryptTrustedAccessBootstrapMock,
  generateTrustedAccessToken: generateTrustedAccessTokenMock,
  hashTrustedAccessToken: hashTrustedAccessTokenMock,
  TRUSTED_ACCESS_INVITATION_TTL_MINUTES: 15,
}))

describe('Trusted access invitations API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.SITE_URL
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('creates a secure invitation link using forwarded public headers', async () => {
    const trustedPersonChain = {
      select: vi.fn(() => trustedPersonChain),
      eq: vi.fn(() => trustedPersonChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'tp-1',
          email: 'trusted@example.com',
          linked_user_id: 'linked-user-1',
          invitation_status: 'accepted',
          is_active: true,
        },
        error: null,
      }),
    }

    const replaceChain = {
      update: vi.fn(() => replaceChain),
      eq: vi.fn(() => replaceChain),
    }
    replaceChain.eq
      .mockImplementationOnce(() => replaceChain)
      .mockImplementationOnce(() => replaceChain)
      .mockImplementationOnce(() => Promise.resolve({ error: null }))

    const insertChain = {
      insert: vi.fn(() => insertChain),
      select: vi.fn(() => insertChain),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'inv-1',
          expires_at: '2026-03-13T12:15:00.000Z',
        },
        error: null,
      }),
    }

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'trusted_persons') return trustedPersonChain
        if (table === 'trusted_access_invitations') {
          if (replaceChain.update.mock.calls.length === 0) return replaceChain
          return insertChain
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    createServiceRoleSupabaseClientMock.mockReturnValue(adminClient)

    const { POST } = await import('@/app/api/trusted-access/invitations/route')
    const response = await POST(
      new Request('http://0.0.0.0:3000/api/trusted-access/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-host': 'lebensordner.org',
          'x-forwarded-proto': 'https',
        },
        body: JSON.stringify({
          trustedPersonId: 'tp-1',
          bootstrapRelationshipKey: 'a'.repeat(64),
        }),
      })
    )

    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      invitationUrl: 'https://lebensordner.org/zugriff/access/redeem?token=token-123',
      expiresAt: '2026-03-13T12:15:00.000Z',
      deliveryMode: 'manual',
      singleUse: true,
      expiresInMinutes: 15,
    })
  })

  it('returns 500 when the service-role client cannot be created', async () => {
    createServiceRoleSupabaseClientMock.mockImplementation(() => {
      throw new Error('Supabase service-role environment variables are missing')
    })

    const { POST } = await import('@/app/api/trusted-access/invitations/route')
    const response = await POST(
      new Request('http://localhost/api/trusted-access/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trustedPersonId: 'tp-1',
          bootstrapRelationshipKey: 'a'.repeat(64),
        }),
      })
    )

    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Server error' })
    expect(emitStructuredErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: 'config',
        endpoint: '/api/trusted-access/invitations',
      })
    )
  })
})
