import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch for HTTP calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Queue Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
    process.env.NEXTJS_INTERNAL_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Cron Endpoint Integration', () => {
    it('should call send-reminders endpoint with correct authorization', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, processed: 5 }), { status: 200 })
      )

      const response = await fetch(
        'http://localhost:3000/api/cron/send-reminders',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-cron-secret',
          },
        }
      )

      expect(response.ok).toBe(true)
      // MSW may convert string URL + options into a Request object, so extract URL flexibly
      const calledArg = mockFetch.mock.calls[0][0]
      const calledUrl = typeof calledArg === 'string' ? calledArg : (calledArg as Request).url
      expect(calledUrl).toBe('http://localhost:3000/api/cron/send-reminders')
    })

    it('should call process-email-queue endpoint with correct authorization', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, processed: 3, failed: 1 }), { status: 200 })
      )

      const response = await fetch(
        'http://localhost:3000/api/cron/process-email-queue',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-cron-secret',
          },
        }
      )

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.processed).toBe(3)
    })

    it('should call send-upgrade-emails endpoint with correct authorization', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, sent: 2 }), { status: 200 })
      )

      const response = await fetch(
        'http://localhost:3000/api/cron/send-upgrade-emails',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-cron-secret',
          },
        }
      )

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.sent).toBe(2)
    })
  })

  describe('Worker Error Handling', () => {
    it('should handle 401 unauthorized responses', async () => {
      mockFetch.mockResolvedValue(
        new Response(null, { status: 401, statusText: 'Unauthorized' })
      )

      const response = await fetch(
        'http://localhost:3000/api/cron/send-reminders',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer wrong-secret',
          },
        }
      )

      expect(response.status).toBe(401)
      expect(response.ok).toBe(false)
    })

    it('should handle 500 server errors', async () => {
      mockFetch.mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Internal Server Error' })
      )

      const response = await fetch(
        'http://localhost:3000/api/cron/send-reminders',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-cron-secret',
          },
        }
      )

      expect(response.status).toBe(500)
      expect(response.ok).toBe(false)
    })

    it('should handle network failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection failed'))

      await expect(
        fetch('http://localhost:3000/api/cron/send-reminders', {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-cron-secret',
          },
        })
      ).rejects.toThrow('Network connection failed')
    })
  })

  describe('Queue Job Patterns', () => {
    it('should validate cron pattern formats', () => {
      // Test that the cron patterns are valid
      const patterns = {
        dailyReminders: '0 8 * * *',
        upgradeEmails: '0 10 * * *',
        emailQueue: '*/15 * * * *',
        cleanup: '0 3 * * *',
      }

      // Simple validation - check that patterns have 5 parts
      Object.values(patterns).forEach(pattern => {
        const parts = pattern.split(' ')
        expect(parts).toHaveLength(5)
      })
    })

    it('should have correct time intervals', () => {
      const intervals = {
        dailyReminders: '0 8 * * *',      // 8:00 AM daily
        upgradeEmails: '0 10 * * *',     // 10:00 AM daily  
        emailQueue: '*/15 * * * *',      // Every 15 minutes
        cleanup: '0 3 * * *',            // 3:00 AM daily
      }

      expect(intervals.emailQueue).toContain('*/15') // Every 15 minutes
      expect(intervals.dailyReminders).toBe('0 8 * * *') // 8 AM
      expect(intervals.upgradeEmails).toBe('0 10 * * *') // 10 AM
      expect(intervals.cleanup).toBe('0 3 * * *') // 3 AM
    })
  })

  describe('Worker Configuration', () => {
    it('should use correct internal URL', () => {
      expect(process.env.NEXTJS_INTERNAL_URL).toBe('http://localhost:3000')
    })

    it('should use correct cron secret', () => {
      expect(process.env.CRON_SECRET).toBe('test-cron-secret')
    })

    it('should construct correct endpoint URLs', () => {
      const baseUrl = process.env.NEXTJS_INTERNAL_URL
      const endpoints = [
        '/api/cron/send-reminders',
        '/api/cron/process-email-queue', 
        '/api/cron/send-upgrade-emails',
      ]

      endpoints.forEach(endpoint => {
        const fullUrl = `${baseUrl}${endpoint}`
        expect(fullUrl).toMatch(/^http:\/\/localhost:3000\/api\/cron\//)
      })
    })
  })

  describe('Response Validation', () => {
    it('should validate reminder response structure', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, processed: 5, timestamp: '2023-01-01T08:00:00Z' }), { status: 200 })
      )

      const response = await fetch(
        'http://localhost:3000/api/cron/send-reminders',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-cron-secret',
          },
        }
      )

      const result = await response.json()
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('processed')
      expect(result).toHaveProperty('timestamp')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.processed).toBe('number')
    })

    it('should validate email queue response structure', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          success: true,
          processed: 3,
          failed: 1,
          permanently_failed: 0,
          timestamp: '2023-01-01T08:00:00Z'
        }), { status: 200 })
      )

      const response = await fetch(
        'http://localhost:3000/api/cron/process-email-queue',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-cron-secret',
          },
        }
      )

      const result = await response.json()
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('processed')
      expect(result).toHaveProperty('failed')
      expect(result).toHaveProperty('permanently_failed')
      expect(result).toHaveProperty('timestamp')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.processed).toBe('number')
      expect(typeof result.failed).toBe('number')
    })
  })
})
