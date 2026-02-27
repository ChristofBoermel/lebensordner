import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkRateLimit,
  incrementRateLimit,
  cleanupExpiredLimits,
  type RateLimitConfig,
} from '@/lib/security/rate-limit'

// Mock Redis client
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  on: vi.fn(),
} as any

vi.mock('@/lib/redis/client', () => ({
  getRedis: () => mockRedis,
}))

const defaultConfig: RateLimitConfig = {
  identifier: '127.0.0.1',
  endpoint: '/api/login',
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
}

describe('Redis Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkRateLimit', () => {
    it('should allow first request when no existing key', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(900) // 15 minutes

      const result = await checkRateLimit(defaultConfig)
      
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(defaultConfig.maxRequests - 1)
      expect(result.resetAt).toBeInstanceOf(Date)
      expect(mockRedis.incr).toHaveBeenCalledWith('rate:/api/login:127.0.0.1')
      expect(mockRedis.expire).toHaveBeenCalledWith('rate:/api/login:127.0.0.1', 900)
    })

    it('should block request when limit exceeded', async () => {
      mockRedis.incr.mockResolvedValue(6) // Exceeds limit of 5
      mockRedis.ttl.mockResolvedValue(900)

      const result = await checkRateLimit(defaultConfig)
      
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(mockRedis.expire).not.toHaveBeenCalled() // Don't set TTL on subsequent requests
    })

    it('should calculate correct remaining count', async () => {
      mockRedis.incr.mockResolvedValue(3)
      mockRedis.ttl.mockResolvedValue(900)

      const result = await checkRateLimit(defaultConfig)
      
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(defaultConfig.maxRequests - 3)
    })

    it('should calculate correct resetAt timestamp', async () => {
      const now = Date.now()
      vi.setSystemTime(now)
      
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(900)

      const result = await checkRateLimit(defaultConfig)
      const expectedReset = new Date(now + 900 * 1000)
      
      expect(result.resetAt.getTime()).toBeCloseTo(expectedReset.getTime(), -2)
      
      vi.useRealTimers()
    })

    it('should return allowed=true on Redis failure (fail-open)', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'))

      const result = await checkRateLimit(defaultConfig)
      
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(defaultConfig.maxRequests)
      expect(result.resetAt).toBeInstanceOf(Date)
    })

    it('should handle zero TTL gracefully', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(0)

      const result = await checkRateLimit(defaultConfig)
      
      expect(result.allowed).toBe(true)
      expect(result.resetAt.getTime()).toBeCloseTo(Date.now(), -2)
    })

    it('should handle negative TTL gracefully', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(-1)

      const result = await checkRateLimit(defaultConfig)
      
      expect(result.allowed).toBe(true)
      expect(result.resetAt.getTime()).toBeCloseTo(Date.now(), -2)
    })
  })

  describe('incrementRateLimit', () => {
    it('should be a no-op function', async () => {
      await incrementRateLimit(defaultConfig)
      
      // Should not call any Redis methods
      expect(mockRedis.incr).not.toHaveBeenCalled()
      expect(mockRedis.expire).not.toHaveBeenCalled()
      expect(mockRedis.ttl).not.toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredLimits', () => {
    it('should be a no-op function', async () => {
      const result = await cleanupExpiredLimits()
      
      // Should return 0 and not call any Redis methods
      expect(result).toBe(0)
      expect(mockRedis.incr).not.toHaveBeenCalled()
      expect(mockRedis.expire).not.toHaveBeenCalled()
      expect(mockRedis.ttl).not.toHaveBeenCalled()
    })
  })

  describe('Rate Limit Key Generation', () => {
    it('should generate correct key format', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(900)

      const config: RateLimitConfig = {
        identifier: 'user-123',
        endpoint: '/api/upload',
        maxRequests: 10,
        windowMs: 60 * 1000,
      }

      await checkRateLimit(config)
      
      expect(mockRedis.incr).toHaveBeenCalledWith('rate:/api/upload:user-123')
    })

    it('should handle special characters in identifier', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(900)

      const config: RateLimitConfig = {
        identifier: 'user@example.com',
        endpoint: '/api/auth/login',
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
      }

      await checkRateLimit(config)
      
      expect(mockRedis.incr).toHaveBeenCalledWith('rate:/api/auth/login:user@example.com')
    })
  })

  describe('Window Size Calculation', () => {
    it('should calculate correct window seconds for different time windows', async () => {
      const testCases = [
        { windowMs: 60 * 1000, expectedSec: 60 },      // 1 minute
        { windowMs: 15 * 60 * 1000, expectedSec: 900 }, // 15 minutes
        { windowMs: 60 * 60 * 1000, expectedSec: 3600 }, // 1 hour
        { windowMs: 24 * 60 * 60 * 1000, expectedSec: 86400 }, // 24 hours
      ]

      for (const testCase of testCases) {
        vi.clearAllMocks()
        
        mockRedis.incr.mockResolvedValue(1)
        mockRedis.expire.mockResolvedValue(1)
        mockRedis.ttl.mockResolvedValue(testCase.expectedSec)

        const config: RateLimitConfig = {
          identifier: 'test-user',
          endpoint: '/api/test',
          maxRequests: 10,
          windowMs: testCase.windowMs,
        }

        await checkRateLimit(config)
        
        expect(mockRedis.expire).toHaveBeenCalledWith(
          expect.any(String),
          testCase.expectedSec
        )
      }
    })
  })
})
