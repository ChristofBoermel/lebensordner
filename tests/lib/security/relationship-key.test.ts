import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../../mocks/supabase-client'

vi.mock('@/lib/security/document-e2ee', () => ({
  generateRelationshipKey: vi.fn(async () => 'a'.repeat(64)),
  importRawHexKey: vi.fn(async () => 'generated-rk'),
  unwrapKey: vi.fn(async (wrapped: string) => `unwrapped:${wrapped}`),
  wrapKey: vi.fn(async () => 'wrapped-generated-rk'),
}))

describe('loadOrCreateRelationshipKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns the existing relationship key when present', async () => {
    const { client } = createSupabaseMock({
      maybeSingle: {
        data: { wrapped_rk: 'existing-rk' },
        error: null,
      },
    })

    const { loadOrCreateRelationshipKey } = await import('@/lib/security/relationship-key')

    const result = await loadOrCreateRelationshipKey({
      supabase: client,
      ownerId: 'owner-1',
      trustedPersonId: 'tp-1',
      masterKey: 'master-key' as unknown as CryptoKey,
    })

    expect(result).toBe('unwrapped:existing-rk')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('creates and stores a relationship key when the row is missing', async () => {
    const { client } = createSupabaseMock({
      maybeSingle: {
        data: null,
        error: null,
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    )

    const { loadOrCreateRelationshipKey } = await import('@/lib/security/relationship-key')

    const result = await loadOrCreateRelationshipKey({
      supabase: client,
      ownerId: 'owner-1',
      trustedPersonId: 'tp-1',
      masterKey: 'master-key' as unknown as CryptoKey,
    })

    expect(result).toBe('generated-rk')
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/trusted-person/relationship-key',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })
})
