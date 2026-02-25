import { vi } from 'vitest'

export interface SupabaseMockOverrides {
  single?: { data: unknown; error: unknown }
  maybeSingle?: { data: unknown; error: unknown }
  getUser?: { data: unknown; error: unknown }
  then?: { data: unknown[]; error: null }
}

export function createSupabaseMock(overrides: SupabaseMockOverrides = {}) {
  const single = vi.fn().mockResolvedValue(
    overrides.single ?? { data: null, error: null }
  )
  const maybeSingle = vi.fn().mockResolvedValue(
    overrides.maybeSingle ?? { data: null, error: null }
  )
  const getUser = vi.fn().mockResolvedValue(
    overrides.getUser ?? { data: { user: null }, error: null }
  )
  const signInWithPassword = vi.fn().mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  })
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

  const thenDefault = overrides.then ?? { data: [] as unknown[], error: null as null }

  const thenFn = vi.fn().mockImplementation(
    (
      onFulfilled?: ((value: { data: unknown[]; error: null }) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(thenDefault).then(onFulfilled, onRejected)
  )

  const builder: Record<string, unknown> = {}

  // Use vi.fn(() => builder) instead of vi.fn().mockReturnThis():
  // Constructor-time implementations survive vi.restoreAllMocks(), while
  // post-construction mockReturnThis() is cleared by vi.restoreAllMocks().
  // This keeps methods as vi.fn() (assertable) AND resistant to restoreAllMocks.
  const chainMethods = [
    'select', 'eq', 'neq', 'gte', 'lte', 'lt', 'gt', 'in', 'not', 'is',
    'ilike', 'order', 'limit', 'upsert', 'insert', 'update', 'delete',
  ] as const
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder)
  }

  // Terminal methods
  builder.single = single
  builder.maybeSingle = maybeSingle

  // Direct-await support via vi.fn() for overridability
  builder.then = thenFn

  const client = {
    auth: {
      getUser,
      signInWithPassword,
    },
    from: vi.fn(() => builder),
    rpc,
  }

  return { client, builder, single, maybeSingle, getUser, signInWithPassword, rpc, thenFn }
}
