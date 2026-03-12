import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSupabaseMock } from '../mocks/supabase-client'

const { client: supabaseMockClient, thenFn, single, maybeSingle, getUser, builder } = createSupabaseMock()

const adminBuilder: Record<string, unknown> = {}
const adminSingle = vi.fn()
const adminMaybySingle = vi.fn()
const adminThenFn = vi.fn().mockImplementation(
  (onFulfilled?: ((value: any) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
    Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
)
adminBuilder.select = vi.fn(() => adminBuilder)
adminBuilder.eq = vi.fn(() => adminBuilder)
adminBuilder.in = vi.fn(() => adminBuilder)
adminBuilder.is = vi.fn(() => adminBuilder)
adminBuilder.single = adminSingle
adminBuilder.maybeSingle = adminMaybySingle
adminBuilder.then = adminThenFn

const mockStorageDownload = vi.fn()
const adminClient = {
  from: vi.fn(() => adminBuilder),
  storage: { from: vi.fn(() => ({ download: mockStorageDownload })) },
}

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => adminClient) }))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(supabaseMockClient)),
}))

describe('Share Token API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: 'owner-id' } }, error: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/documents/share-token', () => {
    it('creates share with expiry and permission', async () => {
      // First maybeSingle: document ownership check
      maybeSingle.mockResolvedValueOnce({ data: { id: 'doc-1' }, error: null })
      // Second maybeSingle: trusted person check
      maybeSingle.mockResolvedValueOnce({ data: { id: 'tp-1', linked_user_id: 'tp-user' }, error: null })
      // upsert result
      thenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled)
      )

      vi.resetModules()
      const { POST } = await import('@/app/api/documents/share-token/route')

      const response = await POST(
        new Request('http://localhost/api/documents/share-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: 'doc-1',
            trustedPersonId: 'tp-1',
            wrapped_dek_for_tp: 'wrapped-key',
            expires_at: '2027-01-01T00:00:00Z',
            permission: 'download',
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          expires_at: '2027-01-01T00:00:00Z',
          permission: 'download',
          revoked_at: null,
        }),
        expect.any(Object)
      )
    })

    it('creates share without expiry and defaults permission to view', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'doc-1' }, error: null })
      maybeSingle.mockResolvedValueOnce({ data: { id: 'tp-1', linked_user_id: 'tp-user' }, error: null })
      thenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled)
      )

      vi.resetModules()
      const { POST } = await import('@/app/api/documents/share-token/route')

      const response = await POST(
        new Request('http://localhost/api/documents/share-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: 'doc-1',
            trustedPersonId: 'tp-1',
            wrapped_dek_for_tp: 'wrapped-key',
            expires_at: null,
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ permission: 'view', expires_at: null, revoked_at: null }),
        expect.any(Object)
      )
    })

    it('reactivates a previously revoked share by writing revoked_at as null', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'doc-1' }, error: null })
      maybeSingle.mockResolvedValueOnce({ data: { id: 'tp-1', linked_user_id: 'tp-user' }, error: null })
      thenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled)
      )

      vi.resetModules()
      const { POST } = await import('@/app/api/documents/share-token/route')

      const response = await POST(
        new Request('http://localhost/api/documents/share-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: 'doc-1',
            trustedPersonId: 'tp-1',
            wrapped_dek_for_tp: 'wrapped-key',
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 'doc-1',
          trusted_person_id: 'tp-1',
          revoked_at: null,
        }),
        expect.any(Object)
      )
    })

    it('returns 403 when trusted person has no linked_user_id', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'doc-1' }, error: null })
      maybeSingle.mockResolvedValueOnce({ data: { id: 'tp-1', linked_user_id: null }, error: null })

      vi.resetModules()
      const { POST } = await import('@/app/api/documents/share-token/route')

      const response = await POST(
        new Request('http://localhost/api/documents/share-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: 'doc-1',
            trustedPersonId: 'tp-1',
            wrapped_dek_for_tp: 'wrapped-key',
          }),
        })
      )
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('accepted')
    })

    it('returns 403 when trusted person not found', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'doc-1' }, error: null })
      maybeSingle.mockResolvedValueOnce({ data: null, error: null })

      vi.resetModules()
      const { POST } = await import('@/app/api/documents/share-token/route')

      const response = await POST(
        new Request('http://localhost/api/documents/share-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: 'doc-1',
            trustedPersonId: 'tp-1',
            wrapped_dek_for_tp: 'wrapped-key',
          }),
        })
      )

      expect(response.status).toBe(403)
    })

    it('falls back to legacy schema when optional share-token columns are missing', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'doc-1' }, error: null })
      maybeSingle.mockResolvedValueOnce({ data: { id: 'tp-1', linked_user_id: 'tp-user' }, error: null })
      thenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { code: '42703', message: 'column "expires_at" does not exist' },
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled)
        )

      vi.resetModules()
      const { POST } = await import('@/app/api/documents/share-token/route')

      const response = await POST(
        new Request('http://localhost/api/documents/share-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: 'doc-1',
            trustedPersonId: 'tp-1',
            wrapped_dek_for_tp: 'wrapped-key',
            expires_at: '2027-01-01T00:00:00Z',
            permission: 'download',
          }),
        })
      )

      expect(response.status).toBe(200)
      expect(builder.upsert).toHaveBeenNthCalledWith(
        2,
        {
          document_id: 'doc-1',
          owner_id: 'owner-id',
          trusted_person_id: 'tp-1',
          wrapped_dek_for_tp: 'wrapped-key',
        },
        expect.any(Object)
      )
    })
  })

  describe('DELETE /api/documents/share-token', () => {
    it('sets revoked_at on the share token', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'share-1', owner_id: 'owner-id' }, error: null })
      thenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled)
      )

      vi.resetModules()
      const { DELETE } = await import('@/app/api/documents/share-token/route')

      const response = await DELETE(
        new Request('http://localhost/api/documents/share-token?id=share-1', {
          method: 'DELETE',
        })
      )

      expect(response.status).toBe(200)
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ revoked_at: expect.any(String) })
      )
    })

    it('returns 403 when non-owner tries to revoke', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'share-1', owner_id: 'other-user-id' }, error: null })

      vi.resetModules()
      const { DELETE } = await import('@/app/api/documents/share-token/route')

      const response = await DELETE(
        new Request('http://localhost/api/documents/share-token?id=share-1', {
          method: 'DELETE',
        })
      )

      expect(response.status).toBe(403)
    })

    it('returns 400 when id param is missing', async () => {
      vi.resetModules()
      const { DELETE } = await import('@/app/api/documents/share-token/route')

      const response = await DELETE(
        new Request('http://localhost/api/documents/share-token', {
          method: 'DELETE',
        })
      )

      expect(response.status).toBe(400)
    })

    it('falls back to hard delete when revoked_at is missing', async () => {
      maybeSingle.mockResolvedValueOnce({ data: { id: 'share-1', owner_id: 'owner-id' }, error: null })
      thenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { code: '42703', message: 'column "revoked_at" does not exist' },
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled)
        )

      vi.resetModules()
      const { DELETE } = await import('@/app/api/documents/share-token/route')

      const response = await DELETE(
        new Request('http://localhost/api/documents/share-token?id=share-1', {
          method: 'DELETE',
        })
      )

      expect(response.status).toBe(200)
      expect(builder.delete).toHaveBeenCalled()
    })
  })

  describe('GET /api/documents/share-token (owner)', () => {
    it('returns active owner shares with nested document and trusted person metadata', async () => {
      thenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'share-1',
              document_id: 'doc-1',
              trusted_person_id: 'tp-1',
              wrapped_dek_for_tp: 'wrapped-key',
              expires_at: '2027-01-01T00:00:00Z',
              permission: 'view',
              revoked_at: null,
              created_at: '2026-03-10T12:00:00Z',
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'doc-1', title: 'My Doc', category: 'finanzen', file_name: 'doc.pdf' }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'tp-1', name: 'Max Mustermann', email: 'max@example.com' }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ owner_id: 'owner-id', trusted_person_id: 'tp-1' }],
            error: null,
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token?ownerId=owner-id')
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tokens[0]).toMatchObject({
        trusted_person_id: 'tp-1',
        expires_at: '2027-01-01T00:00:00Z',
        permission: 'view',
        revoked_at: null,
        documents: expect.objectContaining({ title: 'My Doc' }),
        trusted_persons: expect.objectContaining({ name: 'Max Mustermann' }),
        access_link_setup: expect.objectContaining({
          ownerAccessLinkStatus: 'ready',
          requiresManualAccessLinkDelivery: true,
          userMessageKey: 'copy_and_send_access_link',
        }),
      })
    })

    it('filters revoked and expired owner shares from the response', async () => {
      thenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [
              {
                id: 'share-active',
                document_id: 'doc-1',
                trusted_person_id: 'tp-1',
                wrapped_dek_for_tp: 'wrapped-key',
                expires_at: '2099-01-01T00:00:00Z',
                permission: 'download',
                revoked_at: null,
                created_at: '2026-03-10T12:00:00Z',
              },
              {
                id: 'share-revoked',
                document_id: 'doc-2',
                trusted_person_id: 'tp-2',
                wrapped_dek_for_tp: 'wrapped-key',
                expires_at: '2099-01-01T00:00:00Z',
                permission: 'view',
                revoked_at: '2026-03-10T12:30:00Z',
                created_at: '2026-03-10T12:00:00Z',
              },
              {
                id: 'share-expired',
                document_id: 'doc-3',
                trusted_person_id: 'tp-3',
                wrapped_dek_for_tp: 'wrapped-key',
                expires_at: '2020-01-01T00:00:00Z',
                permission: 'view',
                revoked_at: null,
                created_at: '2026-03-10T12:00:00Z',
              },
            ],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'doc-1', title: 'Active Doc', category: 'finanzen', file_name: 'active.pdf' }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'tp-1', name: 'Active Person', email: 'active@example.com' }],
            error: null,
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token?ownerId=owner-id')
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tokens).toHaveLength(1)
      expect(data.tokens[0].id).toBe('share-active')
    })

    it('rejects requests for another owner id', async () => {
      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token?ownerId=other-owner')
      )

      expect(response.status).toBe(403)
    })

    it('falls back to legacy schema when owner list optional columns are missing', async () => {
      thenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { code: '42703', message: 'column "permission" does not exist' },
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'share-1',
              document_id: 'doc-1',
              trusted_person_id: 'tp-1',
              wrapped_dek_for_tp: 'wrapped-key',
              created_at: '2026-03-10T12:00:00Z',
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'doc-1', title: 'My Doc', category: 'finanzen', file_name: 'doc.pdf' }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'tp-1', name: 'Max Mustermann', email: 'max@example.com' }],
            error: null,
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token?ownerId=owner-id')
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tokens[0]).toMatchObject({
        permission: 'view',
        revoked_at: null,
        expires_at: null,
      })
    })

    it('keeps owner shares when related metadata hydration fails', async () => {
      thenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'share-1',
              document_id: 'doc-1',
              trusted_person_id: 'tp-1',
              wrapped_dek_for_tp: 'wrapped-key',
              expires_at: null,
              permission: 'view',
              revoked_at: null,
              created_at: '2026-03-10T12:00:00Z',
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { message: 'documents lookup failed', code: 'PGRST100' },
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { message: 'trusted persons lookup failed', code: 'PGRST100' },
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token?ownerId=owner-id')
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tokens[0]).toMatchObject({
        id: 'share-1',
        documents: null,
        trusted_persons: null,
      })
    })
  })

  describe('GET /api/documents/share-token/received', () => {
    it('returns shares for recipient with nested documents and profiles', async () => {
      adminThenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'share-1',
              document_id: 'doc-1',
              owner_id: 'owner-id',
              trusted_person_id: 'tp-1',
              wrapped_dek_for_tp: 'wrapped-key',
              expires_at: null,
              permission: 'view',
              revoked_at: null,
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'doc-1',
              title: 'My Doc',
              category: 'personal',
              file_name: 'doc.pdf',
              file_iv: 'iv',
              file_type: 'application/pdf',
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'owner-id', full_name: 'Owner User', first_name: 'Owner', last_name: 'User' }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ owner_id: 'owner-id', trusted_person_id: 'tp-1' }],
            error: null,
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/received/route')

      const response = await GET(new Request('http://localhost/api/documents/share-token/received'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shares).toHaveLength(1)
      expect(data.shares[0]).toMatchObject({
        id: 'share-1',
        documents: expect.objectContaining({ title: 'My Doc' }),
        profiles: expect.objectContaining({ full_name: 'Owner User' }),
        access_link_readiness: expect.objectContaining({
          accessLinkStatus: 'missing_on_device',
          ownerAccessLinkStatus: 'ready',
          requiresAccessLinkSetup: true,
          userMessageKey: 'open_access_link_on_device',
        }),
      })
    })

    it('filters revoked and expired received shares', async () => {
      adminThenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [
              {
                id: 'share-active',
                document_id: 'doc-1',
                owner_id: 'owner-id',
                trusted_person_id: 'tp-1',
                wrapped_dek_for_tp: 'wrapped-key',
                expires_at: '2099-01-01T00:00:00Z',
                permission: 'download',
                revoked_at: null,
              },
              {
                id: 'share-revoked',
                document_id: 'doc-2',
                owner_id: 'owner-id',
                trusted_person_id: 'tp-1',
                wrapped_dek_for_tp: 'wrapped-key',
                expires_at: '2099-01-01T00:00:00Z',
                permission: 'view',
                revoked_at: '2026-01-01T00:00:00Z',
              },
              {
                id: 'share-expired',
                document_id: 'doc-3',
                owner_id: 'owner-id',
                trusted_person_id: 'tp-1',
                wrapped_dek_for_tp: 'wrapped-key',
                expires_at: '2020-01-01T00:00:00Z',
                permission: 'view',
                revoked_at: null,
              },
            ],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'doc-1',
              title: 'Active Doc',
              category: 'personal',
              file_name: 'active.pdf',
              file_iv: 'iv',
              file_type: 'application/pdf',
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'owner-id', full_name: 'Owner User', first_name: 'Owner', last_name: 'User' }],
            error: null,
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/received/route')

      const response = await GET(new Request('http://localhost/api/documents/share-token/received'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shares).toHaveLength(1)
      expect(data.shares[0].id).toBe('share-active')
    })

    it('returns empty array when user has no trusted_person records', async () => {
      adminThenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled)
      )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/received/route')

      const response = await GET(new Request('http://localhost/api/documents/share-token/received'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shares).toEqual([])
    })

    it('falls back to legacy schema when recipient list optional columns are missing', async () => {
      adminThenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { code: '42703', message: 'column "revoked_at" does not exist' },
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'share-1',
              document_id: 'doc-1',
              owner_id: 'owner-id',
              trusted_person_id: 'tp-1',
              wrapped_dek_for_tp: 'wrapped-key',
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'doc-1',
              title: 'My Doc',
              category: 'personal',
              file_name: 'doc.pdf',
              file_iv: 'iv',
              file_type: 'application/pdf',
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{ id: 'owner-id', full_name: 'Owner User', first_name: 'Owner', last_name: 'User' }],
            error: null,
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/received/route')

      const response = await GET(new Request('http://localhost/api/documents/share-token/received'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shares[0]).toMatchObject({
        permission: 'view',
        revoked_at: null,
        expires_at: null,
      })
    })

    it('keeps received shares when document and profile hydration fails', async () => {
      adminThenFn
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: [{
              id: 'share-1',
              document_id: 'doc-1',
              owner_id: 'owner-id',
              trusted_person_id: 'tp-1',
              wrapped_dek_for_tp: 'wrapped-key',
              expires_at: null,
              permission: 'view',
              revoked_at: null,
            }],
            error: null,
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { message: 'documents lookup failed', code: 'PGRST100' },
          }).then(onFulfilled)
        )
        .mockImplementationOnce((onFulfilled: any) =>
          Promise.resolve({
            data: null,
            error: { message: 'profiles lookup failed', code: 'PGRST100' },
          }).then(onFulfilled)
        )

      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/received/route')

      const response = await GET(new Request('http://localhost/api/documents/share-token/received'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shares[0]).toMatchObject({
        id: 'share-1',
        trusted_person_id: 'tp-1',
        documents: expect.objectContaining({ id: 'doc-1', title: 'Unbekanntes Dokument' }),
        profiles: { full_name: null, first_name: null, last_name: null },
        access_link_readiness: expect.objectContaining({
          accessLinkStatus: 'missing_on_owner',
          userMessageKey: 'owner_must_send_access_link',
        }),
      })
    })
  })

  describe('GET /api/documents/share-token/[id]/file', () => {
    beforeEach(() => {
      adminSingle.mockReset()
      adminMaybySingle.mockReset()
      adminThenFn.mockReset()
      mockStorageDownload.mockReset()
      adminThenFn.mockImplementation((onFulfilled: any, onRejected?: any) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
      )
    })

    it('returns 401 when not authenticated', async () => {
      getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/[id]/file/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token/share-1/file'),
        { params: Promise.resolve({ id: 'share-1' }) }
      )

      expect(response.status).toBe(401)
    })

    it('returns 404 when caller is not a recipient', async () => {
      adminThenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled)
      )
      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/[id]/file/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token/share-1/file'),
        { params: Promise.resolve({ id: 'share-1' }) }
      )

      expect(response.status).toBe(404)
    })

    it('returns 404 when share is revoked', async () => {
      adminThenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
      )
      adminMaybySingle.mockResolvedValueOnce({
        data: { id: 'share-1', document_id: 'doc-1', revoked_at: '2024-01-01T00:00:00Z', expires_at: null },
        error: null,
      })
      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/[id]/file/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token/share-1/file'),
        { params: Promise.resolve({ id: 'share-1' }) }
      )

      expect(response.status).toBe(404)
    })

    it('returns 200 with file bytes', async () => {
      adminThenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
      )
      adminMaybySingle.mockResolvedValueOnce({
        data: { id: 'share-1', document_id: 'doc-1', revoked_at: null, expires_at: null },
        error: null,
      })
      adminSingle.mockResolvedValueOnce({ data: { file_path: 'user/doc.enc' }, error: null })
      const fakeBytes = new Uint8Array([1, 2, 3])
      mockStorageDownload.mockResolvedValueOnce({
        data: { arrayBuffer: vi.fn().mockResolvedValue(fakeBytes.buffer) },
        error: null,
      })
      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/[id]/file/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token/share-1/file'),
        { params: Promise.resolve({ id: 'share-1' }) }
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/octet-stream')
    })

    it('sets Cache-Control: no-store on 200', async () => {
      adminThenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
      )
      adminMaybySingle.mockResolvedValueOnce({
        data: { id: 'share-1', document_id: 'doc-1', revoked_at: null, expires_at: null },
        error: null,
      })
      adminSingle.mockResolvedValueOnce({ data: { file_path: 'user/doc.enc' }, error: null })
      const fakeBytes = new Uint8Array([1, 2, 3])
      mockStorageDownload.mockResolvedValueOnce({
        data: { arrayBuffer: vi.fn().mockResolvedValue(fakeBytes.buffer) },
        error: null,
      })
      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/[id]/file/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token/share-1/file'),
        { params: Promise.resolve({ id: 'share-1' }) }
      )

      expect(response.headers.get('Cache-Control')).toBe('no-store')
    })

    it('falls back to legacy schema when file access optional columns are missing', async () => {
      adminThenFn.mockImplementationOnce((onFulfilled: any) =>
        Promise.resolve({ data: [{ id: 'tp-1' }], error: null }).then(onFulfilled)
      )
      adminMaybySingle
        .mockResolvedValueOnce({
          data: null,
          error: { code: '42703', message: 'column "expires_at" does not exist' },
        })
        .mockResolvedValueOnce({
          data: { id: 'share-1', document_id: 'doc-1' },
          error: null,
        })
      adminSingle.mockResolvedValueOnce({ data: { file_path: 'user/doc.enc' }, error: null })
      const fakeBytes = new Uint8Array([1, 2, 3])
      mockStorageDownload.mockResolvedValueOnce({
        data: { arrayBuffer: vi.fn().mockResolvedValue(fakeBytes.buffer) },
        error: null,
      })
      vi.resetModules()
      const { GET } = await import('@/app/api/documents/share-token/[id]/file/route')

      const response = await GET(
        new Request('http://localhost/api/documents/share-token/share-1/file'),
        { params: Promise.resolve({ id: 'share-1' }) }
      )

      expect(response.status).toBe(200)
    })
  })
})
