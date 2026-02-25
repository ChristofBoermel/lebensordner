import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  logSecurityEvent,
  maskIpAddress,
  extractUserAgent,
  EVENT_LOGIN_SUCCESS,
  EVENT_LOGIN_FAILURE,
  EVENT_UNAUTHORIZED_ACCESS,
} from '@/lib/security/audit-log'
import { createSupabaseMock } from '../../mocks/supabase-client'

// Mock Supabase client
const { client, builder } = createSupabaseMock()
const mockFrom = client.from
const mockInsert = builder.insert as ReturnType<typeof vi.fn>

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => client),
}))

describe('audit-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('maskIpAddress', () => {
    it('should mask IPv4 last octet', () => {
      expect(maskIpAddress('192.168.1.123')).toBe('192.168.1.xxx')
    })

    it('should mask different IPv4 addresses', () => {
      expect(maskIpAddress('10.0.0.1')).toBe('10.0.0.xxx')
      expect(maskIpAddress('255.255.255.255')).toBe('255.255.255.xxx')
    })

    it('should mask IPv6 last 4 segments', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      const masked = maskIpAddress(ipv6)
      expect(masked).toBe('2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx')
    })

    it('should handle short IPv6 addresses', () => {
      expect(maskIpAddress('::1')).toBe('::xxxx')
    })

    it('should return Unknown for empty string', () => {
      expect(maskIpAddress('')).toBe('Unknown')
    })
  })

  describe('extractUserAgent', () => {
    it('should extract user-agent from request headers', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'user-agent') return 'Mozilla/5.0 Test Browser'
            return null
          }),
        },
      } as any

      expect(extractUserAgent(mockRequest)).toBe('Mozilla/5.0 Test Browser')
    })

    it('should return Unknown when request is undefined', () => {
      expect(extractUserAgent(undefined)).toBe('Unknown')
    })

    it('should return Unknown when user-agent header is missing', () => {
      const mockRequest = {
        headers: {
          get: vi.fn(() => null),
        },
      } as any

      expect(extractUserAgent(mockRequest)).toBe('Unknown')
    })
  })

  describe('logSecurityEvent', () => {
    it('should insert record with correct fields', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'x-forwarded-for') return '192.168.1.100'
            if (header === 'user-agent') return 'Test Agent'
            return null
          }),
        },
        ip: undefined,
      } as any

      await logSecurityEvent({
        user_id: 'user-123',
        event_type: EVENT_LOGIN_SUCCESS,
        event_data: { method: 'email' },
        request: mockRequest,
      })

      expect(mockFrom).toHaveBeenCalledWith('security_audit_log')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          event_type: EVENT_LOGIN_SUCCESS,
          event_data: { method: 'email' },
          ip_address: '192.168.1.xxx',
          user_agent: 'Test Agent',
        })
      )
    })

    it('should parse first IP from comma-separated x-forwarded-for', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'x-forwarded-for') return '1.2.3.4, proxy'
            if (header === 'user-agent') return 'Test Agent'
            return null
          }),
        },
        ip: undefined,
      } as any

      await logSecurityEvent({
        user_id: 'user-proxy',
        event_type: EVENT_LOGIN_SUCCESS,
        request: mockRequest,
      })

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '1.2.3.xxx',
        })
      )
    })

    it('should handle event without request', async () => {
      await logSecurityEvent({
        user_id: 'user-456',
        event_type: EVENT_LOGIN_FAILURE,
      })

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-456',
          event_type: EVENT_LOGIN_FAILURE,
          ip_address: null,
          user_agent: 'Unknown',
        })
      )
    })

    it('should handle event without user_id', async () => {
      await logSecurityEvent({
        event_type: EVENT_UNAUTHORIZED_ACCESS,
      })

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
          event_type: EVENT_UNAUTHORIZED_ACCESS,
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      mockInsert.mockRejectedValueOnce(new Error('DB error'))

      await expect(
        logSecurityEvent({
          event_type: EVENT_LOGIN_SUCCESS,
        })
      ).resolves.toBeUndefined()
    })
  })

  describe('event type constants', () => {
    it('should have correct values', () => {
      expect(EVENT_LOGIN_SUCCESS).toBe('login_success')
      expect(EVENT_LOGIN_FAILURE).toBe('login_failure')
      expect(EVENT_UNAUTHORIZED_ACCESS).toBe('unauthorized_access')
    })
  })
})
