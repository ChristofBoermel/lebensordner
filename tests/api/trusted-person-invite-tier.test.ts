import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_BASIC_MONTHLY,
} from '../fixtures/stripe'

// Mock Resend module
const mockResendSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}))

// Track Supabase operations
const mockSupabaseUpdate = vi.fn()
const mockSupabaseInsert = vi.fn()

// Configurable mock profile for tier testing
let mockProfileConfig = {
  subscription_status: null as string | null,
  stripe_price_id: null as string | null,
}

let mockTrustedPersonCount = 0

const createMockSupabaseClient = () => {
  const mockTrustedPerson = {
    id: 'tp_test_123',
    user_id: 'test-user-id',
    name: 'Test Trusted Person',
    email: 'trusted@example.com',
    relationship: 'Familie',
    invitation_token: null,
    invitation_sent_at: null,
    invitation_status: 'pending',
    email_status: null,
    email_retry_count: 0,
  }

  const mockProfile = {
    id: 'test-user-id',
    full_name: 'Test Owner',
    email: 'owner@example.com',
    ...mockProfileConfig,
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'owner@example.com' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'trusted_persons') {
        return {
          select: vi.fn((selectArg?: string, options?: { count?: string; head?: boolean }) => {
            // Handle count query for tier limit check
            if (options?.count === 'exact' && options?.head === true) {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                  count: mockTrustedPersonCount,
                }),
              }
            }
            // Handle regular select query
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockTrustedPerson,
                    error: null,
                  }),
                }),
                ilike: vi.fn().mockReturnValue({
                  neq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }
          }),
          update: mockSupabaseUpdate.mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: mockSupabaseInsert.mockResolvedValue({ error: null }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockProfile,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'email_retry_queue') {
        return {
          insert: mockSupabaseInsert.mockResolvedValue({ error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: mockSupabaseUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: mockSupabaseInsert.mockResolvedValue({ error: null }),
      }
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(createMockSupabaseClient())),
}))

// Mock Supabase client for direct createClient usage (in resend-service)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockSupabaseInsert.mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })),
  })),
}))

// Helper functions to set user tiers
function setFreeUser() {
  mockProfileConfig = {
    subscription_status: null,
    stripe_price_id: null,
  }
}

function setBasicUser() {
  mockProfileConfig = {
    subscription_status: 'active',
    stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
  }
}

function setPremiumUser() {
  mockProfileConfig = {
    subscription_status: 'active',
    stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
  }
}

function setTrustedPersonCount(count: number) {
  mockTrustedPersonCount = count
}

describe('Trusted Person Invite API - Tier Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFreeUser() // Default to free user
    setTrustedPersonCount(0)
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.lebensordner.org'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Free User Blocking', () => {
    it('should reject Free users with 403 - familyDashboard feature required', async () => {
      setFreeUser()

      // Need to reset modules to pick up new mock config
      vi.resetModules()
      const { POST } = await import('@/app/api/trusted-person/invite/route')

      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('kostenpflichtiges Abo')
    })
  })

  describe('Basic User Access', () => {
    it('should allow Basic users to invite trusted persons', async () => {
      setBasicUser()
      setTrustedPersonCount(0)
      mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

      vi.resetModules()
      const { POST } = await import('@/app/api/trusted-person/invite/route')

      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)

      // Should not be 403 (tier rejection)
      expect(response.status).not.toBe(403)
    })

    it('should reject Basic users at their limit (3 trusted persons)', async () => {
      setBasicUser()
      setTrustedPersonCount(3) // Basic limit

      vi.resetModules()
      const { POST } = await import('@/app/api/trusted-person/invite/route')

      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('maximal')
      expect(data.error).toContain('3')
    })
  })

  describe('Premium User Access', () => {
    it('should allow Premium users to invite trusted persons', async () => {
      setPremiumUser()
      setTrustedPersonCount(0)
      mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

      vi.resetModules()
      const { POST } = await import('@/app/api/trusted-person/invite/route')

      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)

      // Should not be 403 (tier rejection)
      expect(response.status).not.toBe(403)
    })

    it('should reject Premium users at their limit (5 trusted persons)', async () => {
      setPremiumUser()
      setTrustedPersonCount(5) // Premium limit

      vi.resetModules()
      const { POST } = await import('@/app/api/trusted-person/invite/route')

      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('maximal')
      expect(data.error).toContain('5')
    })
  })

  describe('Limit Boundary Testing', () => {
    it('should allow Basic user with 2 trusted persons (under limit)', async () => {
      setBasicUser()
      setTrustedPersonCount(2) // Under limit of 3
      mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

      vi.resetModules()
      const { POST } = await import('@/app/api/trusted-person/invite/route')

      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)

      expect(response.status).not.toBe(403)
    })

    it('should allow Premium user with 4 trusted persons (under limit)', async () => {
      setPremiumUser()
      setTrustedPersonCount(4) // Under limit of 5
      mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

      vi.resetModules()
      const { POST } = await import('@/app/api/trusted-person/invite/route')

      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)

      expect(response.status).not.toBe(403)
    })
  })
})
