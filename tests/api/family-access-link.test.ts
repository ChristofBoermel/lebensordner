import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminBuilder: Record<string, unknown> = {}
const adminSingle = vi.fn()
const adminThen = vi.fn()

for (const method of ['select', 'eq', 'in', 'is', 'order'] as const) {
  adminBuilder[method] = vi.fn(() => adminBuilder)
}
adminBuilder.single = adminSingle
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

vi.mock('@/lib/security/audit-log', () => ({
  logSecurityEvent: vi.fn(),
  EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED: 'trusted_person_document_viewed',
}))

vi.mock('@/app/api/family/view/stream/route', () => ({
  generateStreamToken: vi.fn(() => 'stream-token-123'),
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
    adminBuilder.then = adminThen
  })

  it('returns ready access-link readiness from /api/family/view when the client signals the local key is present', async () => {
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
          data: [{ owner_id: 'owner-1', trusted_person_id: 'tp-1' }],
          error: null,
        }).then(onFulfilled, onRejected)
      )
      .mockImplementationOnce((onFulfilled: any, onRejected?: any) =>
        Promise.resolve({
          data: [{ document_id: 'doc-1', wrapped_dek_for_tp: 'wrapped', expires_at: null }],
          error: null,
        }).then(onFulfilled, onRejected)
      )
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
        headers: { 'x-lebensordner-access-link-key': 'present' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.accessLinkReadiness).toMatchObject({
      accessLinkStatus: 'ready',
      requiresAccessLinkSetup: false,
      ownerAccessLinkStatus: 'ready',
      deviceAccessLinkStatus: 'ready',
      userMessageKey: 'access_ready',
    })
    expect(data.encryptedDocumentCount).toBe(1)
  })

  it('returns missing-on-owner readiness from /api/family/download when the owner has not created a relationship key', async () => {
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
          data: [],
          error: null,
        }).then(onFulfilled, onRejected)
      )
      .mockImplementationOnce((onFulfilled: any, onRejected?: any) =>
        Promise.resolve({
          data: [{ document_id: 'doc-1', wrapped_dek_for_tp: 'wrapped', expires_at: null, permission: 'download' }],
          error: null,
        }).then(onFulfilled, onRejected)
      )
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
      accessLinkStatus: 'missing_on_owner',
      requiresAccessLinkSetup: true,
      ownerAccessLinkStatus: 'missing_on_owner',
      userMessageKey: 'owner_must_send_access_link',
    })
  })
})
