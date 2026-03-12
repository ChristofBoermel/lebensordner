import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminBuilder: Record<string, unknown> = {}
const adminSingle = vi.fn()
const adminMaybeSingle = vi.fn()
const adminThen = vi.fn()

for (const method of ['select', 'eq', 'in', 'is', 'order'] as const) {
  adminBuilder[method] = vi.fn(() => adminBuilder)
}
adminBuilder.single = adminSingle
adminBuilder.maybeSingle = adminMaybeSingle
adminBuilder.then = adminThen

const adminClient = {
  from: vi.fn(() => adminBuilder),
  storage: { from: vi.fn(() => ({ download: vi.fn() })) },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => adminClient),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/lib/auth/resolve-authenticated-user', () => ({
  resolveAuthenticatedUser: vi.fn(() => Promise.resolve({ id: 'viewer-id' })),
}))

vi.mock('@/lib/security/trusted-person-guard', () => ({
  guardTrustedPersonAccess: vi.fn(() =>
    Promise.resolve({
      allowed: true,
      trustedPerson: { id: 'tp-1', name: 'Trusted Person', access_level: 'immediate' },
    })
  ),
}))

const getActiveTrustedPersonShareTokensMock = vi.fn()

vi.mock('@/lib/security/trusted-person-shares', () => ({
  getActiveTrustedPersonShareTokens: (...args: unknown[]) => getActiveTrustedPersonShareTokensMock(...args),
}))

vi.mock('@/lib/security/audit-log', () => ({
  logSecurityEvent: vi.fn(),
  EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED: 'trusted_person_document_viewed',
}))

vi.mock('@/app/api/family/view/stream/route', () => ({
  generateStreamToken: vi.fn(() => 'stream-token-123'),
}))

vi.mock('@/lib/security/trusted-access', () => ({
  buildTrustedAccessReadiness: vi.fn((params: any) => ({
    accessLinkStatus: params.hasDeviceEnrollment ? 'ready' : 'setup_required',
    requiresAccessLinkSetup: !params.hasDeviceEnrollment,
    deviceEnrollmentStatus: params.hasDeviceEnrollment ? 'enrolled' : 'missing',
    userMessageKey: params.hasDeviceEnrollment ? 'access_ready' : 'secure_access_setup_required',
  })),
  fetchLatestTrustedAccessInvitationMap: vi.fn(() => Promise.resolve(new Map())),
  readCookieValueFromHeader: vi.fn((cookieHeader: string | null) => cookieHeader),
  TRUSTED_ACCESS_DEVICE_COOKIE: 'trusted_access_device',
  validateTrustedAccessDevice: vi.fn((_: any, params: any) =>
    Promise.resolve({
      enrolled: Boolean(params.rawCookieValue),
      revoked: false,
    })
  ),
}))

describe('Family access-link readiness APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminBuilder.select = vi.fn(() => adminBuilder)
    adminBuilder.eq = vi.fn(() => adminBuilder)
    adminBuilder.in = vi.fn(() => adminBuilder)
    adminBuilder.is = vi.fn(() => adminBuilder)
    adminBuilder.order = vi.fn(() => adminBuilder)
    adminBuilder.single = adminSingle
    adminBuilder.maybeSingle = adminMaybeSingle
    adminBuilder.then = adminThen
    getActiveTrustedPersonShareTokensMock.mockResolvedValue({
      tokens: [{ document_id: 'doc-1', wrapped_dek_for_tp: 'wrapped', expires_at: null, permission: 'download', revoked_at: null }],
      tokenMap: { 'doc-1': 'wrapped' },
      documentIds: ['doc-1'],
    })
  })

  it('returns ready access-link readiness from /api/family/view when the device is enrolled', async () => {
    adminMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'device-1',
        device_secret_hash: 'valid-hash',
        revoked_at: null,
      },
      error: null,
    })
    adminSingle.mockResolvedValueOnce({
      data: {
        full_name: 'Owner User',
        email: 'owner@example.com',
        subscription_status: 'active',
        stripe_price_id: 'price_basic',
      },
      error: null,
    })

    adminThen
      .mockImplementationOnce((onFulfilled: any, onRejected?: any) =>
        Promise.resolve({
          data: [{
            id: 'doc-1',
            title: 'Encrypted Doc',
            file_name: 'secret.pdf',
            file_path: 'owner-1/secret.pdf',
            file_type: 'application/pdf',
            file_size: 123,
            category: 'finanzen',
            subcategory: null,
            expiry_date: null,
            notes: null,
            created_at: '2026-03-12T10:00:00Z',
            is_encrypted: true,
            file_iv: 'iv-123',
          }],
          error: null,
        }).then(onFulfilled, onRejected)
      )

    vi.resetModules()
    const { GET } = await import('@/app/api/family/view/route')

    const response = await GET(
      new Request('http://localhost/api/family/view?ownerId=owner-1', {
        headers: {
          cookie: 'trusted_access_device=present',
        },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.accessLinkReadiness).toMatchObject({
      accessLinkStatus: 'ready',
      requiresAccessLinkSetup: false,
      deviceEnrollmentStatus: 'enrolled',
      userMessageKey: 'access_ready',
    })
    expect(data.encryptedDocumentCount).toBe(1)
  })

  it('returns setup-required readiness from /api/family/download when no device enrollment exists', async () => {
    adminMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    adminSingle.mockResolvedValueOnce({
      data: {
        full_name: 'Owner User',
        email: 'owner@example.com',
        subscription_status: 'active',
        stripe_price_id: 'price_premium',
      },
      error: null,
    })

    adminThen
      .mockImplementationOnce((onFulfilled: any, onRejected?: any) =>
        Promise.resolve({
          data: [{
            id: 'doc-1',
            file_name: 'secret.pdf',
            file_type: 'application/pdf',
            category: 'finanzen',
            is_encrypted: true,
            file_iv: 'iv-123',
          }],
          error: null,
        }).then(onFulfilled, onRejected)
      )

    vi.resetModules()
    const { GET } = await import('@/app/api/family/download/route')

    const response = await GET(
      new Request('http://localhost/api/family/download?ownerId=owner-1')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.requiresClientDecryption).toBe(true)
    expect(data.accessLinkReadiness).toMatchObject({
      accessLinkStatus: 'setup_required',
      requiresAccessLinkSetup: true,
      deviceEnrollmentStatus: 'missing',
      userMessageKey: 'secure_access_setup_required',
    })
  })
})
