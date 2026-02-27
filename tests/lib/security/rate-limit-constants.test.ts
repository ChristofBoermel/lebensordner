import { describe, it, expect } from 'vitest'
import {
  RATE_LIMIT_LOGIN,
  RATE_LIMIT_PASSWORD_RESET,
  RATE_LIMIT_API,
  RATE_LIMIT_UPLOAD,
  RATE_LIMIT_2FA,
  RATE_LIMIT_INVITE,
  RATE_LIMIT_DOWNLOAD_LINK,
} from '@/lib/security/rate-limit'

describe('Rate Limit Constants', () => {
  describe('Login Rate Limits', () => {
    it('should have correct login limits', () => {
      expect(RATE_LIMIT_LOGIN.maxRequests).toBe(5)
      expect(RATE_LIMIT_LOGIN.windowMs).toBe(15 * 60 * 1000) // 15 minutes
    })

    it('should have reasonable login limits for security', () => {
      expect(RATE_LIMIT_LOGIN.maxRequests).toBeLessThan(10) // Not too permissive
      expect(RATE_LIMIT_LOGIN.windowMs).toBeLessThan(30 * 60 * 1000) // Not too long window
    })
  })

  describe('Password Reset Rate Limits', () => {
    it('should have correct password reset limits', () => {
      expect(RATE_LIMIT_PASSWORD_RESET.maxRequests).toBe(3)
      expect(RATE_LIMIT_PASSWORD_RESET.windowMs).toBe(60 * 60 * 1000) // 1 hour
    })

    it('should be more restrictive than login', () => {
      expect(RATE_LIMIT_PASSWORD_RESET.maxRequests).toBeLessThanOrEqual(RATE_LIMIT_LOGIN.maxRequests)
      expect(RATE_LIMIT_PASSWORD_RESET.windowMs).toBeGreaterThanOrEqual(RATE_LIMIT_LOGIN.windowMs)
    })
  })

  describe('API Rate Limits', () => {
    it('should have correct API limits', () => {
      expect(RATE_LIMIT_API.maxRequests).toBe(100)
      expect(RATE_LIMIT_API.windowMs).toBe(60 * 60 * 1000) // 1 hour
    })

    it('should allow more requests than auth endpoints', () => {
      expect(RATE_LIMIT_API.maxRequests).toBeGreaterThan(RATE_LIMIT_LOGIN.maxRequests)
      expect(RATE_LIMIT_API.maxRequests).toBeGreaterThan(RATE_LIMIT_PASSWORD_RESET.maxRequests)
    })
  })

  describe('Upload Rate Limits', () => {
    it('should have correct upload limits', () => {
      expect(RATE_LIMIT_UPLOAD.maxRequests).toBe(10)
      expect(RATE_LIMIT_UPLOAD.windowMs).toBe(60 * 1000) // 1 minute
    })

    it('should have a short window for upload protection', () => {
      expect(RATE_LIMIT_UPLOAD.windowMs).toBeLessThan(5 * 60 * 1000) // Less than 5 minutes
    })
  })

  describe('2FA Rate Limits', () => {
    it('should have correct 2FA limits', () => {
      expect(RATE_LIMIT_2FA.maxRequests).toBe(5)
      expect(RATE_LIMIT_2FA.windowMs).toBe(15 * 60 * 1000) // 15 minutes
    })

    it('should match login rate limits for consistency', () => {
      expect(RATE_LIMIT_2FA.maxRequests).toBe(RATE_LIMIT_LOGIN.maxRequests)
      expect(RATE_LIMIT_2FA.windowMs).toBe(RATE_LIMIT_LOGIN.windowMs)
    })
  })

  describe('Invite Rate Limits', () => {
    it('should have correct invite limits', () => {
      expect(RATE_LIMIT_INVITE.maxRequests).toBe(5)
      expect(RATE_LIMIT_INVITE.windowMs).toBe(60 * 60 * 1000) // 1 hour
    })

    it('should be limited to prevent spam', () => {
      expect(RATE_LIMIT_INVITE.maxRequests).toBeLessThan(20)
      expect(RATE_LIMIT_INVITE.windowMs).toBeGreaterThanOrEqual(30 * 60 * 1000) // At least 30 minutes
    })
  })

  describe('Download Link Rate Limits', () => {
    it('should have correct download link limits', () => {
      expect(RATE_LIMIT_DOWNLOAD_LINK.maxRequests).toBe(10)
      expect(RATE_LIMIT_DOWNLOAD_LINK.windowMs).toBe(60 * 60 * 1000) // 1 hour
    })

    it('should allow reasonable access but prevent abuse', () => {
      expect(RATE_LIMIT_DOWNLOAD_LINK.maxRequests).toBeGreaterThan(5)
      expect(RATE_LIMIT_DOWNLOAD_LINK.maxRequests).toBeLessThan(50)
    })
  })

  describe('Rate Limit Consistency', () => {
    it('should have consistent time windows for similar operations', () => {
      // Auth-related operations should have similar windows
      const authWindows = [
        RATE_LIMIT_LOGIN.windowMs,
        RATE_LIMIT_2FA.windowMs,
      ]
      
      authWindows.forEach(window => {
        expect(window).toBe(15 * 60 * 1000) // 15 minutes
      })

      // Hourly operations should have 1-hour windows
      const hourlyWindows = [
        RATE_LIMIT_PASSWORD_RESET.windowMs,
        RATE_LIMIT_API.windowMs,
        RATE_LIMIT_INVITE.windowMs,
        RATE_LIMIT_DOWNLOAD_LINK.windowMs,
      ]
      
      hourlyWindows.forEach(window => {
        expect(window).toBe(60 * 60 * 1000) // 1 hour
      })
    })

    it('should have appropriate request limits for security', () => {
      // Critical operations should be more limited
      expect(RATE_LIMIT_PASSWORD_RESET.maxRequests).toBeLessThanOrEqual(3)
      expect(RATE_LIMIT_LOGIN.maxRequests).toBeLessThanOrEqual(5)
      expect(RATE_LIMIT_2FA.maxRequests).toBeLessThanOrEqual(5)

      // General operations can be more permissive
      expect(RATE_LIMIT_API.maxRequests).toBeGreaterThan(50)
      expect(RATE_LIMIT_UPLOAD.maxRequests).toBeGreaterThan(5)
    })

    it('should have reasonable window durations', () => {
      // All windows should be reasonable (not too short, not too long)
      const allLimits = [
        RATE_LIMIT_LOGIN,
        RATE_LIMIT_PASSWORD_RESET,
        RATE_LIMIT_API,
        RATE_LIMIT_UPLOAD,
        RATE_LIMIT_2FA,
        RATE_LIMIT_INVITE,
        RATE_LIMIT_DOWNLOAD_LINK,
      ]

      allLimits.forEach(limit => {
        expect(limit.windowMs).toBeGreaterThanOrEqual(60 * 1000) // At least 1 minute
        expect(limit.windowMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000) // At most 24 hours
      })
    })
  })

  describe('Rate Limit Values', () => {
    it('should have integer request limits', () => {
      const allLimits = [
        RATE_LIMIT_LOGIN,
        RATE_LIMIT_PASSWORD_RESET,
        RATE_LIMIT_API,
        RATE_LIMIT_UPLOAD,
        RATE_LIMIT_2FA,
        RATE_LIMIT_INVITE,
        RATE_LIMIT_DOWNLOAD_LINK,
      ]

      allLimits.forEach(limit => {
        expect(Number.isInteger(limit.maxRequests)).toBe(true)
        expect(limit.maxRequests).toBeGreaterThan(0)
      })
    })

    it('should have positive window durations', () => {
      const allLimits = [
        RATE_LIMIT_LOGIN,
        RATE_LIMIT_PASSWORD_RESET,
        RATE_LIMIT_API,
        RATE_LIMIT_UPLOAD,
        RATE_LIMIT_2FA,
        RATE_LIMIT_INVITE,
        RATE_LIMIT_DOWNLOAD_LINK,
      ]

      allLimits.forEach(limit => {
        expect(limit.windowMs).toBeGreaterThan(0)
        expect(Number.isInteger(limit.windowMs)).toBe(true)
      })
    })
  })
})
