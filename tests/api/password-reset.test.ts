import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PRIVACY_POLICY_VERSION } from '@/lib/consent/constants'

// --- Mock: auth.resetPasswordForEmail ---
const mockResetPasswordForEmail = vi.fn()

// --- Mock: auth.exchangeCodeForSession ---
const mockExchangeCodeForSession = vi.fn()

// --- Mock: auth.signOut ---
const mockSignOut = vi.fn().mockResolvedValue({ error: null })

// --- Mock: server Supabase client ---
const serverClient = {
  auth: {
    resetPasswordForEmail: mockResetPasswordForEmail,
    exchangeCodeForSession: mockExchangeCodeForSession,
    signOut: mockSignOut,
  },
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(serverClient)),
}))

// --- Admin client per-table dispatch ---
let mockAdminProfileSingle = vi.fn()

const createAdminTableDispatch = () =>
  vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockAdminProfileSingle,
          })),
        })),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }
    if (table === 'trusted_persons') {
      const builder: Record<string, unknown> = {}
      const then = vi.fn().mockImplementation(
        (onFulfilled?: ((v: { data: unknown[]; error: null }) => unknown) | null) =>
          Promise.resolve({ data: [], error: null }).then(onFulfilled)
      )
      builder.update = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.is = vi.fn(() => builder)
      builder.select = vi.fn(() => builder)
      builder.then = then
      return builder
    }
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })) })),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

const adminClient = {
  from: createAdminTableDispatch(),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => adminClient),
}))

// --- Mock: isAccountLocked ---
const mockIsAccountLocked = vi.fn()

vi.mock('@/lib/security/auth-lockout', () => ({
  isAccountLocked: (...args: unknown[]) => mockIsAccountLocked(...args),
}))

// --- Mock: consent manager ---
const mockGetCurrentConsent = vi.fn()
const mockRecordConsent = vi.fn()

vi.mock('@/lib/consent/manager', () => ({
  getCurrentConsent: (...args: unknown[]) => mockGetCurrentConsent(...args),
  recordConsent: (...args: unknown[]) => mockRecordConsent(...args),
}))

// --- Mock: rate-limit ---
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date(Date.now() + 60_000) }),
  incrementRateLimit: vi.fn().mockResolvedValue(undefined),
  RATE_LIMIT_PASSWORD_RESET: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
}))

// --- Mock: audit-log ---
vi.mock('@/lib/security/audit-log', () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
  EVENT_PASSWORD_RESET_REQUESTED: 'password_reset_requested',
}))

// --- Mock: next/headers (cookies) ---
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}))

// --- beforeEach defaults ---
beforeEach(() => {
  vi.clearAllMocks()

  mockIsAccountLocked.mockResolvedValue(false)
  mockGetCurrentConsent.mockResolvedValue({ version: PRIVACY_POLICY_VERSION })
  mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  mockExchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: new Error('not configured') })
  mockAdminProfileSingle = vi.fn().mockResolvedValue({ data: null, error: null })

  // Rebuild admin dispatch so mockAdminProfileSingle is picked up
  adminClient.from = createAdminTableDispatch()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ======================================================================
// Password reset request
// ======================================================================

describe('Password reset request', () => {
  it("sets redirectTo to /auth/callback?next=/passwort-reset", async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/auth/password-reset/request/route')

    const request = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    await POST(request as any)

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: expect.stringContaining('/auth/callback?next=/passwort-reset') }
    )
  })
})

// ======================================================================
// Auth callback — existing user, onboarding complete
// ======================================================================

describe('Auth callback — existing user, onboarding complete', () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'uid', email: 'u@e.com' } },
      error: null,
    })
    mockAdminProfileSingle.mockResolvedValue({
      data: { id: 'uid', onboarding_completed: true },
      error: null,
    })
    adminClient.from = createAdminTableDispatch()
  })

  it("redirects to /passwort-reset when next=/passwort-reset", async () => {
    vi.resetModules()
    const { GET } = await import('@/app/auth/callback/route')

    const response = await GET(
      new Request('http://localhost/auth/callback?code=abc&next=/passwort-reset')
    )

    expect(response.headers.get('location')).toMatch(/\/passwort-reset$/)
  })

  it("redirects to /dashboard when no next param (regression guard)", async () => {
    vi.resetModules()
    const { GET } = await import('@/app/auth/callback/route')

    const response = await GET(
      new Request('http://localhost/auth/callback?code=abc')
    )

    expect(response.headers.get('location')).toMatch(/\/dashboard$/)
  })
})

// ======================================================================
// Auth callback — new user
// ======================================================================

describe('Auth callback — new user', () => {
  it("redirects to /passwort-reset when next=/passwort-reset (regression guard)", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'new-uid', email: 'new@e.com' } },
      error: null,
    })
    mockAdminProfileSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' },
    })
    adminClient.from = createAdminTableDispatch()

    vi.resetModules()
    const { GET } = await import('@/app/auth/callback/route')

    const response = await GET(
      new Request('http://localhost/auth/callback?code=abc&next=/passwort-reset')
    )

    expect(response.headers.get('location')).toMatch(/\/passwort-reset$/)
  })
})
