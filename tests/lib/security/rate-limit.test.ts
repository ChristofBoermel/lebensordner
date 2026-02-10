import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkRateLimit,
  incrementRateLimit,
  cleanupExpiredLimits,
  RATE_LIMIT_LOGIN,
  RATE_LIMIT_PASSWORD_RESET,
  RATE_LIMIT_API,
  RATE_LIMIT_UPLOAD,
  type RateLimitConfig,
} from '@/lib/security/rate-limit'

// Mock Supabase client
const mockSingle = vi.fn()
const mockLimit = vi.fn(() => ({ single: mockSingle }))
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockGte = vi.fn(() => ({ order: mockOrder }))
const mockEqChain = vi.fn(() => ({ gte: mockGte }))
const mockEq = vi.fn(() => ({ eq: mockEqChain }))
const mockSelectLt = vi.fn(() => ({ count: 0 }))
const mockSelect = vi.fn(() => ({ eq: mockEq, lt: mockSelectLt }))
const mockInsert = vi.fn(() => ({ error: null }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
const mockLt = vi.fn(() => ({ error: null }))
const mockDelete = vi.fn(() => ({ lt: mockLt }))

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

const defaultConfig: RateLimitConfig = {
  identifier: '127.0.0.1',
  endpoint: '/api/login',
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
}

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkRateLimit', () => {
    it('should allow first request when no existing record', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const result = await checkRateLimit(defaultConfig)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(defaultConfig.maxRequests - 1)
      expect(result.resetAt).toBeInstanceOf(Date)
    })

    it('should block request when limit exceeded', async () => {
      const windowStart = new Date().toISOString()
      mockSingle.mockResolvedValueOnce({
        data: { request_count: 5, window_start: windowStart },
        error: null,
      })

      const result = await checkRateLimit(defaultConfig)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should calculate correct remaining count', async () => {
      const windowStart = new Date().toISOString()
      mockSingle.mockResolvedValueOnce({
        data: { request_count: 3, window_start: windowStart },
        error: null,
      })

      const result = await checkRateLimit(defaultConfig)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(defaultConfig.maxRequests - 3 - 1)
    })

    it('should calculate correct resetAt timestamp', async () => {
      const windowStart = new Date()
      mockSingle.mockResolvedValueOnce({
        data: { request_count: 1, window_start: windowStart.toISOString() },
        error: null,
      })

      const result = await checkRateLimit(defaultConfig)
      const expectedReset = new Date(windowStart.getTime() + defaultConfig.windowMs)
      expect(result.resetAt.getTime()).toBeCloseTo(expectedReset.getTime(), -2)
    })

    it('should return allowed=true on database failure (fail-open)', async () => {
      mockSingle.mockRejectedValueOnce(new Error('DB connection failed'))

      const result = await checkRateLimit(defaultConfig)
      expect(result.allowed).toBe(true)
    })
  })

  describe('incrementRateLimit', () => {
    it('should create new record on first call', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      await incrementRateLimit(defaultConfig)
      expect(mockInsert).toHaveBeenCalled()
    })

    it('should increment existing record', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'existing-id', request_count: 2 },
        error: null,
      })

      await incrementRateLimit(defaultConfig)
      expect(mockUpdate).toHaveBeenCalledWith({ request_count: 3 })
    })

    it('should handle database errors gracefully', async () => {
      mockSingle.mockRejectedValueOnce(new Error('DB error'))

      await expect(incrementRateLimit(defaultConfig)).resolves.toBeUndefined()
    })
  })

  describe('cleanupExpiredLimits', () => {
    it('should delete old records and return count', async () => {
      mockSelectLt.mockReturnValueOnce({ count: 5 })

      const result = await cleanupExpiredLimits()
      expect(mockFrom).toHaveBeenCalledWith('rate_limits')
      expect(mockSelectLt).toHaveBeenCalled()
      expect(mockDelete).toHaveBeenCalled()
      expect(mockLt).toHaveBeenCalled()
      expect(result).toBe(5)
    })

    it('should handle database errors gracefully', async () => {
      mockSelectLt.mockRejectedValueOnce(new Error('DB error'))

      await expect(cleanupExpiredLimits()).resolves.toBe(0)
    })
  })

  describe('default rate limit constants', () => {
    it('should have correct login limits', () => {
      expect(RATE_LIMIT_LOGIN.maxRequests).toBe(5)
      expect(RATE_LIMIT_LOGIN.windowMs).toBe(15 * 60 * 1000)
    })

    it('should have correct password reset limits', () => {
      expect(RATE_LIMIT_PASSWORD_RESET.maxRequests).toBe(3)
      expect(RATE_LIMIT_PASSWORD_RESET.windowMs).toBe(60 * 60 * 1000)
    })

    it('should have correct API limits', () => {
      expect(RATE_LIMIT_API.maxRequests).toBe(100)
      expect(RATE_LIMIT_API.windowMs).toBe(60 * 60 * 1000)
    })

    it('should have correct upload limits', () => {
      expect(RATE_LIMIT_UPLOAD.maxRequests).toBe(10)
      expect(RATE_LIMIT_UPLOAD.windowMs).toBe(60 * 60 * 1000)
    })
  })
})
