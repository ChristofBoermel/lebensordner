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

const {
  buildTrustedAccessSetupLinkExpiryMock,
  emitTrustedAccessEventMock,
  encryptTrustedAccessBootstrapMock,
  generateTrustedAccessTokenMock,
  hashTrustedAccessTokenMock,
} = vi.hoisted(() => ({
  buildTrustedAccessSetupLinkExpiryMock: vi.fn(() => '2026-03-14T12:15:00.000Z'),
  emitTrustedAccessEventMock: vi.fn(() => Promise.resolve()),
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
  buildTrustedAccessSetupLinkExpiry: buildTrustedAccessSetupLinkExpiryMock,
  emitTrustedAccessEvent: emitTrustedAccessEventMock,
  encryptTrustedAccessBootstrap: encryptTrustedAccessBootstrapMock,
  generateTrustedAccessToken: generateTrustedAccessTokenMock,
  hashTrustedAccessToken: hashTrustedAccessTokenMock,
  TRUSTED_ACCESS_SETUP_LINK_TTL_HOURS: 24,
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

  it('creates a secure setup link using the redeem API entrypoint', async () => {
    const trustedPersonSelectChain = {
      select: vi.fn(() => trustedPersonSelectChain),
      eq: vi.fn(() => trustedPersonSelectChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'tp-1',
          email: 'trusted@example.com',
          linked_user_id: 'linked-user-1',
          invitation_status: 'accepted',
          relationship_status: 'accepted_pending_setup',
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
          expires_at: '2026-03-14T12:15:00.000Z',
        },
        error: null,
      }),
    }

    const relationshipUpdateChain = {
      update: vi.fn(() => relationshipUpdateChain),
      eq: vi.fn(() => relationshipUpdateChain),
    }
    relationshipUpdateChain.eq
      .mockImplementationOnce(() => relationshipUpdateChain)
      .mockImplementationOnce(() => Promise.resolve({ error: null }))

    let trustedPersonCallCount = 0
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'trusted_persons') {
          trustedPersonCallCount += 1
          return trustedPersonCallCount === 1 ? trustedPersonSelectChain : relationshipUpdateChain
        }
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
      invitationUrl: 'https://lebensordner.org/api/trusted-access/invitations/redeem?token=token-123',
      expiresAt: '2026-03-14T12:15:00.000Z',
      deliveryMode: 'manual',
      singleUse: true,
      expiresInHours: 24,
    })
    expect(emitTrustedAccessEventMock).toHaveBeenCalledWith(
      adminClient,
      expect.objectContaining({
        relationshipId: 'tp-1',
        eventType: 'setup_link_sent',
      })
    )
  })


  it('still returns the secure setup link when trusted-access event logging fails', async () => {
    const trustedPersonSelectChain = {
      select: vi.fn(() => trustedPersonSelectChain),
      eq: vi.fn(() => trustedPersonSelectChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'tp-1',
          email: 'trusted@example.com',
          linked_user_id: 'linked-user-1',
          invitation_status: 'accepted',
          relationship_status: 'accepted_pending_setup',
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
          expires_at: '2026-03-14T12:15:00.000Z',
        },
        error: null,
      }),
    }

    const relationshipUpdateChain = {
      update: vi.fn(() => relationshipUpdateChain),
      eq: vi.fn(() => relationshipUpdateChain),
    }
    relationshipUpdateChain.eq
      .mockImplementationOnce(() => relationshipUpdateChain)
      .mockImplementationOnce(() => Promise.resolve({ error: null }))

    let trustedPersonCallCount = 0
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'trusted_persons') {
          trustedPersonCallCount += 1
          return trustedPersonCallCount === 1 ? trustedPersonSelectChain : relationshipUpdateChain
        }
        if (table === 'trusted_access_invitations') {
          if (replaceChain.update.mock.calls.length === 0) return replaceChain
          return insertChain
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    }

    createServiceRoleSupabaseClientMock.mockReturnValue(adminClient)
    emitTrustedAccessEventMock.mockRejectedValueOnce(new Error('relation "trusted_access_events" does not exist'))

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
    expect(data.invitationUrl).toBe(
      'https://lebensordner.org/api/trusted-access/invitations/redeem?token=token-123'
    )
    expect(emitStructuredErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/trusted-access/invitations',
        metadata: expect.objectContaining({
          trustedPersonId: 'tp-1',
          invitationId: 'inv-1',
        }),
      })
    )
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
