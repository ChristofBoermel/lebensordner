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
let mockTrustedPersonIlike = vi.fn()

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
      builder.ilike = (...args: unknown[]) => mockTrustedPersonIlike(...args)
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

const supabaseJsClient = {
  auth: {
    resetPasswordForEmail: mockResetPasswordForEmail,
  },
  from: createAdminTableDispatch(),
}

const mockCreateClient = vi.fn(() => supabaseJsClient)

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
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

const mockEmitStructuredError = vi.fn()

vi.mock('@/lib/errors/structured-logger', () => ({
  emitStructuredError: (...args: unknown[]) => mockEmitStructuredError(...args),
  emitStructuredInfo: vi.fn(),
  emitStructuredWarn: vi.fn(),
}))

// --- Mock: next/headers (cookies) ---
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}))

// --- beforeEach defaults ---
beforeEach(async () => {
  vi.clearAllMocks()

  mockIsAccountLocked.mockResolvedValue(false)
  mockGetCurrentConsent.mockResolvedValue({ version: PRIVACY_POLICY_VERSION })
  mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  mockExchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: new Error('not configured') })
  mockAdminProfileSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  mockTrustedPersonIlike = vi.fn(() => {
    const builder: Record<string, unknown> = {}
    builder.eq = vi.fn(() => builder)
    builder.is = vi.fn(() => builder)
    builder.select = vi.fn(() => builder)
    builder.then = vi.fn().mockImplementation(
      (onFulfilled?: ((v: { data: unknown[]; error: null }) => unknown) | null) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled)
    )
    return builder
  })

  const { checkRateLimit, incrementRateLimit } = await import('@/lib/security/rate-limit')
  vi.mocked(checkRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60_000),
  })
  vi.mocked(incrementRateLimit).mockResolvedValue(undefined)

  // Rebuild admin dispatch so mockAdminProfileSingle is picked up
  supabaseJsClient.from = createAdminTableDispatch()
  mockCreateClient.mockReturnValue(supabaseJsClient)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ======================================================================
// Password reset request
// ======================================================================

describe('Password reset request', () => {
  const originalAuthPublicBaseUrl = process.env.AUTH_PUBLIC_BASE_URL
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalSiteUrl = process.env.SITE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://lebensordner.org/supabase'
    process.env.SUPABASE_ANON_KEY = 'anon-test-key'
    delete process.env.AUTH_PUBLIC_BASE_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.SITE_URL
  })

  afterEach(() => {
    if (originalAuthPublicBaseUrl === undefined) {
      delete process.env.AUTH_PUBLIC_BASE_URL
    } else {
      process.env.AUTH_PUBLIC_BASE_URL = originalAuthPublicBaseUrl
    }

    if (originalNextPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
    }

    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL
    } else {
      process.env.SITE_URL = originalSiteUrl
    }
  })

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
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://lebensordner.org/supabase',
      'anon-test-key',
      expect.any(Object)
    )
  })

  it('returns 503 when rate limiter is unavailable', async () => {
    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      available: false,
    } as any)

    const { POST } = await import('@/app/api/auth/password-reset/request/route')

    const request = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const response = await POST(request as any)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error).toMatch(/temporarily unavailable/i)
  })

  it('preserves path segments in NEXT_PUBLIC_SUPABASE_URL when creating reset client', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://lebensordner.org/supabase/'

    const { POST } = await import('@/app/api/auth/password-reset/request/route')

    const request = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const response = await POST(request as any)
    expect(response.status).toBe(200)
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://lebensordner.org/supabase',
      'anon-test-key',
      expect.any(Object)
    )
  })

  it('prefers AUTH_PUBLIC_BASE_URL for redirectTo', async () => {
    process.env.AUTH_PUBLIC_BASE_URL = 'https://lebensordner.org/'
    process.env.NEXT_PUBLIC_APP_URL = 'https://wrong.example'
    process.env.SITE_URL = 'https://wrong2.example'

    const { POST } = await import('@/app/api/auth/password-reset/request/route')

    const request = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const response = await POST(request as any)
    if (response.status !== 200) {
      const payload = await response.json()
      throw new Error(
        `Unexpected status ${response.status}: ${JSON.stringify(payload)} | logger=${JSON.stringify(mockEmitStructuredError.mock.calls)}`
      )
    }

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: 'https://lebensordner.org/auth/callback?next=/passwort-reset' }
    )
  })

  it('falls back to NEXT_PUBLIC_APP_URL when AUTH_PUBLIC_BASE_URL is missing', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://lebensordner.org'
    process.env.SITE_URL = 'https://wrong.example'

    const { POST } = await import('@/app/api/auth/password-reset/request/route')

    const request = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const response = await POST(request as any)
    if (response.status !== 200) {
      const payload = await response.json()
      throw new Error(
        `Unexpected status ${response.status}: ${JSON.stringify(payload)} | logger=${JSON.stringify(mockEmitStructuredError.mock.calls)}`
      )
    }

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: 'https://lebensordner.org/auth/callback?next=/passwort-reset' }
    )
  })

  it('returns 500 when no valid public origin is available', async () => {
    process.env.AUTH_PUBLIC_BASE_URL = 'notaurl'

    const { POST } = await import('@/app/api/auth/password-reset/request/route')

    const request = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'notaurl',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const response = await POST(request as any)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBe('Server configuration error')
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
    expect(mockEmitStructuredError).toHaveBeenCalled()
  })

  it('still returns success when reset email dispatch fails, while logging error', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'SMTP transport failed', status: 500, code: 'smtp_error' },
    })

    const { POST } = await import('@/app/api/auth/password-reset/request/route')

    const request = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    const response = await POST(request as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(mockEmitStructuredError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: 'auth',
        error_message: expect.stringContaining('Password reset email dispatch failed'),
      })
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
    supabaseJsClient.from = createAdminTableDispatch()
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

  it('links trusted persons with normalized case-insensitive email', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'uid', email: 'User@Example.com ' } },
      error: null,
    })
    mockAdminProfileSingle.mockResolvedValue({
      data: { id: 'uid', onboarding_completed: true },
      error: null,
    })
    supabaseJsClient.from = createAdminTableDispatch()

    vi.resetModules()
    const { GET } = await import('@/app/auth/callback/route')

    await GET(
      new Request('http://localhost/auth/callback?code=abc')
    )

    expect(mockTrustedPersonIlike).toHaveBeenCalledWith('email', 'user@example.com')
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
    supabaseJsClient.from = createAdminTableDispatch()

    vi.resetModules()
    const { GET } = await import('@/app/auth/callback/route')

    const response = await GET(
      new Request('http://localhost/auth/callback?code=abc&next=/passwort-reset')
    )

    expect(response.headers.get('location')).toMatch(/\/passwort-reset$/)
  })
})
