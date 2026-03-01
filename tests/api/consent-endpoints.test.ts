import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PRIVACY_POLICY_VERSION } from '@/lib/consent/constants'
import { createSupabaseMock } from '../mocks/supabase-client'

const mockGrantHealthDataConsent = vi.fn()
const mockWithdrawHealthDataConsent = vi.fn()
const mockRecordConsent = vi.fn()
const mockHasHealthDataConsent = vi.fn()
const mockGetCurrentConsent = vi.fn()
const mockRequireAuth = vi.fn()

const mockCheckRateLimit = vi.fn()
const mockIncrementRateLimit = vi.fn()

let mockAuthUser: { id: string; email: string } | null = {
  id: 'test-user-id',
  email: 'owner@example.com',
}

let mockProfileData: { health_data_consent_granted: boolean; health_data_consent_timestamp: string | null } | null = {
  health_data_consent_granted: true,
  health_data_consent_timestamp: '2025-01-01T00:00:00.000Z',
}

let mockProfileError: Error | null = null

const {
  client: supabaseMockClient,
  builder: supabaseBuilder,
  getUser: supabaseGetUser,
  single: supabaseSingle,
  maybeSingle: supabaseMaybeSingle,
} = createSupabaseMock()

vi.mock('@/lib/consent/manager', () => ({
  grantHealthDataConsent: (...args: any[]) => mockGrantHealthDataConsent(...args),
  withdrawHealthDataConsent: (...args: any[]) => mockWithdrawHealthDataConsent(...args),
  recordConsent: (...args: any[]) => mockRecordConsent(...args),
  hasHealthDataConsent: (...args: any[]) => mockHasHealthDataConsent(...args),
  getCurrentConsent: (...args: any[]) => mockGetCurrentConsent(...args),
}))

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
  incrementRateLimit: (...args: any[]) => mockIncrementRateLimit(...args),
  RATE_LIMIT_API: { windowMs: 15 * 60 * 1000, max: 50 },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(supabaseMockClient)),
}))

describe('Consent API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthUser = { id: 'test-user-id', email: 'owner@example.com' }
    mockProfileData = {
      health_data_consent_granted: true,
      health_data_consent_timestamp: '2025-01-01T00:00:00.000Z',
    }
    mockProfileError = null
    // Configure getUser to read live mockAuthUser at call time
    supabaseGetUser.mockImplementation(async () => ({
      data: { user: mockAuthUser },
      error: null,
    }))
    // Configure single to read live mockProfileData/mockProfileError at call time
    supabaseSingle.mockImplementation(async () => ({
      data: mockProfileData,
      error: mockProfileError,
    }))
    supabaseMaybeSingle.mockImplementation(async () => ({
      data: mockProfileData,
      error: mockProfileError,
    }))
    mockHasHealthDataConsent.mockResolvedValue(true)
    mockGetCurrentConsent.mockResolvedValue({
      timestamp: '2025-01-01T00:00:00.000Z',
    })
    mockRequireAuth.mockImplementation(async () => {
      if (!mockAuthUser) {
        const error: any = new Error('Unauthorized')
        error.statusCode = 401
        throw error
      }
      return { user: mockAuthUser }
    })
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 15 * 60 * 1000),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/consent/grant-health-data', () => {
    it('should return 401 when not authenticated', async () => {
      mockAuthUser = null
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/grant-health-data/route')

      const request = new Request('http://localhost/api/consent/grant-health-data', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Authentication required')
    })

    it('should return 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 1000),
      })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/grant-health-data/route')

      const request = new Request('http://localhost/api/consent/grant-health-data', {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })

      const response = await POST(request)
      expect(response.status).toBe(429)
    })

    it('should call grantHealthDataConsent with user ID', async () => {
      mockGrantHealthDataConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/grant-health-data/route')

      const request = new Request('http://localhost/api/consent/grant-health-data', {
        method: 'POST',
      })

      await POST(request)

      expect(mockGrantHealthDataConsent).toHaveBeenCalledWith('test-user-id')
    })

    it('should return 200 with success=true on success', async () => {
      mockGrantHealthDataConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/grant-health-data/route')

      const request = new Request('http://localhost/api/consent/grant-health-data', {
        method: 'POST',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 500 when consent manager returns error', async () => {
      mockGrantHealthDataConsent.mockResolvedValueOnce({ ok: false, error: 'fail' })
      ;(supabaseBuilder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: new Error('fallback') })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/grant-health-data/route')

      const response = await POST(new Request('http://localhost/api/consent/grant-health-data', { method: 'POST' }))
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('fail')
    })

    it('should increment rate limit after successful grant', async () => {
      mockGrantHealthDataConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/grant-health-data/route')

      await POST(new Request('http://localhost/api/consent/grant-health-data', { method: 'POST' }))

      expect(mockIncrementRateLimit).toHaveBeenCalled()
    })

    it('should handle unexpected errors with 500 status', async () => {
      mockGrantHealthDataConsent.mockRejectedValueOnce(new Error('boom'))
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/grant-health-data/route')

      const response = await POST(new Request('http://localhost/api/consent/grant-health-data', { method: 'POST' }))
      expect(response.status).toBe(500)
    })
  })

  describe('POST /api/consent/withdraw-health-data', () => {
    it('should return 401 when not authenticated', async () => {
      mockAuthUser = null
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/withdraw-health-data/route')

      const response = await POST(new Request('http://localhost/api/consent/withdraw-health-data', { method: 'POST' }))
      expect(response.status).toBe(401)
    })

    it('should return 400 when confirmed is not true', async () => {
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/withdraw-health-data/route')

      const request = new Request('http://localhost/api/consent/withdraw-health-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: false }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should return 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 1000),
      })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/withdraw-health-data/route')

      const request = new Request('http://localhost/api/consent/withdraw-health-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify({ confirmed: true }),
      })

      const response = await POST(request)
      expect(response.status).toBe(429)
    })

    it('should call withdrawHealthDataConsent with user ID', async () => {
      mockWithdrawHealthDataConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/withdraw-health-data/route')

      const request = new Request('http://localhost/api/consent/withdraw-health-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })

      await POST(request)

      expect(mockWithdrawHealthDataConsent).toHaveBeenCalledWith('test-user-id')
    })

    it('should return 200 with success message on success', async () => {
      mockWithdrawHealthDataConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/withdraw-health-data/route')

      const request = new Request('http://localhost/api/consent/withdraw-health-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 500 when consent manager returns error', async () => {
      mockWithdrawHealthDataConsent.mockResolvedValueOnce({ ok: false, error: 'fail' })
      ;(supabaseBuilder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: new Error('fallback') })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/withdraw-health-data/route')

      const request = new Request('http://localhost/api/consent/withdraw-health-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
    })

    it('should increment rate limit after successful withdrawal', async () => {
      mockWithdrawHealthDataConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/withdraw-health-data/route')

      const request = new Request('http://localhost/api/consent/withdraw-health-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })

      await POST(request)
      expect(mockIncrementRateLimit).toHaveBeenCalled()
    })
  })

  describe('GET /api/consent/check-health-consent', () => {
    it('should return 401 when not authenticated', async () => {
      mockAuthUser = null
      vi.resetModules()
      const { GET } = await import('@/app/api/consent/check-health-consent/route')

      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('should return granted=true when consent exists', async () => {
      mockHasHealthDataConsent.mockResolvedValueOnce(true)
      mockGetCurrentConsent.mockResolvedValueOnce({
        timestamp: '2025-01-01T00:00:00.000Z',
      })
      vi.resetModules()
      const { GET } = await import('@/app/api/consent/check-health-consent/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.granted).toBe(true)
    })

    it('should return granted=false when consent not granted', async () => {
      mockHasHealthDataConsent.mockResolvedValueOnce(false)
      mockGetCurrentConsent.mockResolvedValueOnce(null)
      mockProfileData = {
        health_data_consent_granted: false,
        health_data_consent_timestamp: null,
      }
      vi.resetModules()
      const { GET } = await import('@/app/api/consent/check-health-consent/route')

      const response = await GET()
      const data = await response.json()

      expect(data.granted).toBe(false)
    })

    it('should return timestamp when consent granted', async () => {
      mockHasHealthDataConsent.mockResolvedValueOnce(true)
      mockGetCurrentConsent.mockResolvedValueOnce({
        timestamp: '2025-01-02T00:00:00.000Z',
      })
      vi.resetModules()
      const { GET } = await import('@/app/api/consent/check-health-consent/route')

      const response = await GET()
      const data = await response.json()

      expect(data.timestamp).toBe('2025-01-02T00:00:00.000Z')
    })

    it('should return null timestamp when consent not granted', async () => {
      mockHasHealthDataConsent.mockResolvedValueOnce(false)
      mockGetCurrentConsent.mockResolvedValueOnce(null)
      mockProfileData = {
        health_data_consent_granted: false,
        health_data_consent_timestamp: null,
      }
      vi.resetModules()
      const { GET } = await import('@/app/api/consent/check-health-consent/route')

      const response = await GET()
      const data = await response.json()

      expect(data.timestamp).toBeNull()
    })

    it('should return 200 with granted: false on database error (fail-open)', async () => {
      mockHasHealthDataConsent.mockRejectedValueOnce(new Error('db'))
      vi.resetModules()
      const { GET } = await import('@/app/api/consent/check-health-consent/route')

      const response = await GET()
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.granted).toBe(false)
    })
  })

  describe('Notfall consent enforcement', () => {
    it('should return 403 on GET when health consent missing', async () => {
      mockHasHealthDataConsent.mockResolvedValueOnce(false)
      mockProfileData = {
        health_data_consent_granted: false,
        health_data_consent_timestamp: null,
      }
      vi.resetModules()
      const { GET } = await import('@/app/api/notfall/route')

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.requiresConsent).toBe(true)

      const { createServerSupabaseClient } = await import('@/lib/supabase/server')
      expect(createServerSupabaseClient).toHaveBeenCalled()
    })

    it('should return 403 on PUT when health consent missing', async () => {
      mockHasHealthDataConsent.mockResolvedValueOnce(false)
      mockProfileData = {
        health_data_consent_granted: false,
        health_data_consent_timestamp: null,
      }
      vi.resetModules()
      const { PUT } = await import('@/app/api/notfall/route')

      const request = new Request('http://localhost/api/notfall', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicalInfo: { blood_type: 'A+' } }),
      })
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.requiresConsent).toBe(true)

      const { createServerSupabaseClient } = await import('@/lib/supabase/server')
      expect(createServerSupabaseClient).toHaveBeenCalled()
    })
  })

  describe('POST /api/consent/accept-privacy-policy', () => {
    it('should return 401 when not authenticated', async () => {
      mockAuthUser = null
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/accept-privacy-policy/route')

      const response = await POST(new Request('http://localhost/api/consent/accept-privacy-policy', { method: 'POST' }))
      expect(response.status).toBe(401)
    })

    it('should return 429 when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 1000),
      })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/accept-privacy-policy/route')

      const request = new Request('http://localhost/api/consent/accept-privacy-policy', {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })

      const response = await POST(request)
      expect(response.status).toBe(429)
    })

    it('should call recordConsent with privacy_policy type', async () => {
      mockRecordConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/accept-privacy-policy/route')

      await POST(new Request('http://localhost/api/consent/accept-privacy-policy', { method: 'POST' }))

      expect(mockRecordConsent).toHaveBeenCalledWith(
        'test-user-id',
        'privacy_policy',
        true,
        PRIVACY_POLICY_VERSION
      )
    })

    it('should use PRIVACY_POLICY_VERSION from constants', async () => {
      mockRecordConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/accept-privacy-policy/route')

      await POST(new Request('http://localhost/api/consent/accept-privacy-policy', { method: 'POST' }))

      expect(mockRecordConsent).toHaveBeenCalledWith(
        expect.any(String),
        'privacy_policy',
        true,
        PRIVACY_POLICY_VERSION
      )
    })

    it('should return 200 with success=true on success', async () => {
      mockRecordConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/accept-privacy-policy/route')

      const response = await POST(new Request('http://localhost/api/consent/accept-privacy-policy', { method: 'POST' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should increment rate limit after successful acceptance', async () => {
      mockRecordConsent.mockResolvedValueOnce({ ok: true })
      vi.resetModules()
      const { POST } = await import('@/app/api/consent/accept-privacy-policy/route')

      await POST(new Request('http://localhost/api/consent/accept-privacy-policy', { method: 'POST' }))

      expect(mockIncrementRateLimit).toHaveBeenCalled()
    })
  })
})
