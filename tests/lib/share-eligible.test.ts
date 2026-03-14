import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('loadShareEligibleTrustedPersons', () => {
  beforeEach(() => {
    // Constructor-time fn per MEMORY.md: survives vi.restoreAllMocks()
    global.fetch = vi.fn(() => Promise.resolve({ ok: true })) as any
    vi.resetModules()
  })

  it('only returns persons with relationship_status active', async () => {
    const allRows = [
      { id: 'tp-1', name: 'Alice', email: 'alice@example.com', linked_user_id: 'user-1', relationship_status: 'active' },
      { id: 'tp-2', name: 'Bob',   email: 'bob@example.com',   linked_user_id: 'user-2', relationship_status: 'accepted_pending_setup' },
      { id: 'tp-3', name: 'Carol', email: 'carol@example.com', linked_user_id: 'user-3', relationship_status: 'setup_link_sent' },
    ]

    // Build chain — declared first so mockSupabase.from can reference it safely.
    // `eq` captures the relationship_status filter arg; `order` simulates the DB
    // filter so the red/green cycle is meaningful (no filter → 3 rows; filter applied → 1 row).
    let capturedRelStatusFilter: string | null = null
    const mockChain: Record<string, unknown> = {}
    mockChain.select = () => mockChain
    mockChain.eq    = (_field: string, value: unknown) => {
      if (_field === 'relationship_status') capturedRelStatusFilter = value as string
      return mockChain
    }
    mockChain.not   = () => mockChain
    mockChain.order = () => {
      const filtered = capturedRelStatusFilter
        ? allRows.filter(r => r.relationship_status === capturedRelStatusFilter)
        : allRows
      return Promise.resolve({ data: filtered, error: null })
    }

    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
      from: () => mockChain,
    }

    const { loadShareEligibleTrustedPersons } = await import('@/lib/trusted-persons/share-eligible')
    const result = await loadShareEligibleTrustedPersons(mockSupabase as any)

    // Before fix: capturedRelStatusFilter is null → 3 rows returned → toHaveLength(1) FAILS
    // After fix: capturedRelStatusFilter is 'active' → 1 row returned → PASSES
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tp-1')
    expect(result[0].name).toBe('Alice')
  })
})
