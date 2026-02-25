import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseMock } from '../mocks/supabase-client'

// --- In-memory lockout state for stateful mock ---
const lockedAccounts = new Map<string, boolean>()

// Mock auth-lockout with in-memory state so lockAccount/unlockAccount/isAccountLocked
// behave realistically across sequential calls within a test.
vi.mock('@/lib/security/auth-lockout', () => ({
  isAccountLocked: vi.fn(async (email: string) => lockedAccounts.get(email) === true),
  lockAccount: vi.fn(async (email: string) => {
    lockedAccounts.set(email, true)
  }),
  unlockAccount: vi.fn(async (email: string) => {
    lockedAccounts.set(email, false)
  }),
  getFailureCount: vi.fn(async () => 0),
  resetFailureCount: vi.fn(async () => {}),
}))

// Mock rate-limit to always allow (focus on lockout behavior)
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 15 * 60 * 1000),
  })),
  incrementRateLimit: vi.fn(async () => {}),
}))

// Mock audit log (no-op, not under test)
vi.mock('@/lib/security/audit-log', () => ({
  logSecurityEvent: vi.fn(async () => {}),
}))

// Mock device detection (no-op, not under test)
vi.mock('@/lib/security/device-detection', () => ({
  isNewDevice: vi.fn(async () => false),
}))

// Mock email notifications (no-op, not under test)
vi.mock('@/lib/email/security-notifications', () => ({
  sendSecurityNotification: vi.fn(async () => {}),
}))

// Mock Supabase server client with spy on signInWithPassword
const { client: supabaseClient, signInWithPassword: mockSignInWithPassword } = createSupabaseMock()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => supabaseClient),
}))

// The login route creates its own Supabase client via createServerClient from @supabase/ssr.
// Mock it to return the same supabaseClient so signInWithPassword is intercepted.
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => supabaseClient),
}))

// Import route handler and lockout functions AFTER mocks are registered
import { POST } from '@/app/api/auth/login/route'
import {
  lockAccount,
  unlockAccount,
  resetFailureCount,
} from '@/lib/security/auth-lockout'

// --- Helpers ---

function createLoginRequest(email: string, password: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'vitest-integration-test',
    },
  })
}

// --- Tests ---

describe('Account Lockout Bypass Prevention - Integration', () => {
  const TEST_EMAIL = 'locked-user@example.com'
  const TEST_PASSWORD = 'correct-password-123'

  beforeEach(() => {
    vi.clearAllMocks()
    lockedAccounts.clear()
  })

  describe('Locked account blocks authentication', () => {
    it('should return 403 when locked account attempts login with correct credentials', async () => {
      await lockAccount(TEST_EMAIL)

      const request = createLoginRequest(TEST_EMAIL, TEST_PASSWORD)
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toContain('Account locked')
      expect(mockSignInWithPassword).not.toHaveBeenCalled()
    })

    it('should NOT call supabase.auth.signInWithPassword for a locked account', async () => {
      await lockAccount(TEST_EMAIL)

      const request = createLoginRequest(TEST_EMAIL, TEST_PASSWORD)
      await POST(request)

      expect(mockSignInWithPassword).toHaveBeenCalledTimes(0)
    })
  })

  describe('Lockout persistence across multiple attempts', () => {
    it('should remain locked on consecutive login attempts', async () => {
      await lockAccount(TEST_EMAIL)

      // First attempt
      const response1 = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      expect(response1.status).toBe(403)

      // Second attempt — account must still be locked
      const response2 = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      expect(response2.status).toBe(403)

      // signInWithPassword must never have been invoked
      expect(mockSignInWithPassword).not.toHaveBeenCalled()
    })
  })

  describe('Unlock then successful login', () => {
    it('should allow login after account is unlocked', async () => {
      // Lock, then unlock
      await lockAccount(TEST_EMAIL)
      await unlockAccount(TEST_EMAIL)

      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: TEST_EMAIL },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
          },
        },
        error: null,
      })

      const response = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.access_token).toBe('test-access-token')
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
    })

    it('should reset failure count on successful login after unlock', async () => {
      await lockAccount(TEST_EMAIL)
      await unlockAccount(TEST_EMAIL)

      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: TEST_EMAIL },
          session: { access_token: 'tok', refresh_token: 'ref' },
        },
        error: null,
      })

      await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))

      expect(resetFailureCount).toHaveBeenCalledWith(TEST_EMAIL)
    })
  })

  describe('Full lockout-to-unlock lifecycle', () => {
    it('should block login when locked, then allow after unlock', async () => {
      // Step 1: Lock the account
      await lockAccount(TEST_EMAIL)

      // Step 2: Attempt login — blocked
      const blockedResponse = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      expect(blockedResponse.status).toBe(403)
      expect(mockSignInWithPassword).not.toHaveBeenCalled()

      // Step 3: Unlock the account
      await unlockAccount(TEST_EMAIL)

      // Step 4: Attempt login — succeeds
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: TEST_EMAIL },
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          },
        },
        error: null,
      })

      const successResponse = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      const successBody = await successResponse.json()

      expect(successResponse.status).toBe(200)
      expect(successBody.success).toBe(true)
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge cases', () => {
    it('should allow login for an account that was never locked', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'user-456', email: TEST_EMAIL },
          session: { access_token: 'at', refresh_token: 'rt' },
        },
        error: null,
      })

      const response = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1)
    })

    it('should include "Account locked" in 403 response body', async () => {
      await lockAccount(TEST_EMAIL)

      const response = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toMatch(/account locked/i)
    })

    it('should isolate lockout to the specific email address', async () => {
      const OTHER_EMAIL = 'other-user@example.com'
      await lockAccount(TEST_EMAIL)

      // Locked user → 403
      const lockedResponse = await POST(createLoginRequest(TEST_EMAIL, TEST_PASSWORD))
      expect(lockedResponse.status).toBe(403)

      // Different user → proceeds to auth
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'user-other', email: OTHER_EMAIL },
          session: { access_token: 'at2', refresh_token: 'rt2' },
        },
        error: null,
      })

      const otherResponse = await POST(createLoginRequest(OTHER_EMAIL, TEST_PASSWORD))
      expect(otherResponse.status).toBe(200)
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1)
    })
  })
})
