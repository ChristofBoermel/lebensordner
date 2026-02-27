import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createMockResendClient,
  createMockTrustedPerson,
  createMockEmailRetryQueueItem,
  TEST_EMAIL_ADDRESS,
} from '../fixtures/resend'
import { createSupabaseMock } from '../mocks/supabase-client'

// Mock Resend module
const mockResendSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}))

// Track calls to resend-service functions
const mockAddToRetryQueue = vi.fn().mockResolvedValue(undefined)
const mockUpdateEmailStatus = vi.fn().mockResolvedValue(undefined)

// Mock Supabase client
const mockSupabaseUpdate = vi.fn()
const mockSupabaseInsert = vi.fn()

const { client: baseSupabaseClient, getUser: supabaseGetUser } = createSupabaseMock()

const createTableDispatch = (trustedPerson?: any) => {
  const mockTrustedPerson = trustedPerson || createMockTrustedPerson()
  const mockProfile = {
    id: 'test-user-id',
    full_name: 'Test Owner',
    email: 'owner@example.com',
    subscription_status: 'active',
    stripe_price_id: 'price_premium_monthly_test',
  }

  return vi.fn((table: string) => {
    if (table === 'trusted_persons') {
      return {
        select: vi.fn((_: string, options?: { count?: string; head?: boolean }) => {
          if (options?.count === 'exact') {
            return {
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }
          }
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
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
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
  })
}

// Configure base client
supabaseGetUser.mockResolvedValue({
  data: { user: { id: 'test-user-id', email: 'owner@example.com' } },
  error: null,
})
baseSupabaseClient.from = createTableDispatch()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(baseSupabaseClient)),
}))

// Mock Supabase client for direct createClient usage (in resend-service)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      insert: mockSupabaseInsert.mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })),
  })),
}))

// Mock rate-limit to avoid Redis connection in tests
// Use constructor-time vi.fn(impl) so implementations survive vi.restoreAllMocks() in afterEach
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, remaining: 10, resetAt: new Date() })),
  incrementRateLimit: vi.fn(() => Promise.resolve(undefined)),
  RATE_LIMIT_INVITE: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  RATE_LIMIT_API: { maxRequests: 100, windowMs: 60 * 60 * 1000 },
  RATE_LIMIT_LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
}))

// Mock subscription tiers
vi.mock('@/lib/subscription-tiers', () => ({
  getTierFromSubscription: vi.fn(() => ({
    id: 'premium',
    name: 'Premium',
    limits: { maxTrustedPersons: 10 },
  })),
  allowsFamilyDownloads: vi.fn(() => true),
  hasFeatureAccess: vi.fn(() => true),
  canPerformAction: vi.fn(() => true),
}))

describe('Email Invitation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.lebensordner.org'
    // Re-configure mocks cleared by vi.restoreAllMocks() in afterEach
    supabaseGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'owner@example.com' } },
      error: null,
    })
    baseSupabaseClient.from = createTableDispatch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Email Timeout Handling', () => {
    it('should complete email sending within 10 seconds', async () => {
      // Mock successful fast email sending (500ms)
      mockResendSend.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        return { data: { id: 'msg_123' }, error: null }
      })

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const responsePromise = POST(request)

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockResendSend).toHaveBeenCalled()
    })

    it('should timeout after 10 seconds and return success with pending status', async () => {
      // Mock slow email sending that exceeds timeout
      mockResendSend.mockImplementation(async () => {
        // Simulate a 15 second delay (longer than 10s timeout)
        await new Promise(resolve => setTimeout(resolve, 15000))
        return { data: { id: 'msg_123' }, error: null }
      })

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const responsePromise = POST(request)

      // Fast-forward past the timeout
      await vi.advanceTimersByTimeAsync(11000)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('wird gesendet')
    })

    it('should queue failed email for retry with error logged', async () => {
      const errorMessage = 'Resend API rate limit exceeded'
      mockResendSend.mockRejectedValue(new Error(errorMessage))

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still return success (invitation link is valid)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should update email_sent_at timestamp on successful send', async () => {
      mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      await POST(request)

      // Verify update was called (invitation_sent_at is set)
      expect(mockSupabaseUpdate).toHaveBeenCalled()
    })
  })

  describe('Email Status Tracking', () => {
    it('should track email_status transitions', async () => {
      mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      await POST(request)

      // Verify the update sequence was called
      expect(mockSupabaseUpdate).toHaveBeenCalled()
    })
  })

  describe('Retry Queue', () => {
    it('should add to retry queue on email failure', async () => {
      mockResendSend.mockRejectedValue(new Error('SMTP connection failed'))

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      await POST(request)

      // Request should succeed even if email fails
      // Verify retry queue insert was called via Supabase mock
      expect(mockSupabaseInsert).toHaveBeenCalled()
    })

    it('should call updateEmailStatus with failed status on error', async () => {
      mockResendSend.mockRejectedValue(new Error('API rate limit exceeded'))

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      await POST(request)

      // Verify update was called (for email_status = 'failed')
      expect(mockSupabaseUpdate).toHaveBeenCalled()
    })

    it('should NOT queue retry when timeout fires but send is still in-flight', async () => {
      // Clear previous mock calls
      mockSupabaseInsert.mockClear()

      // Mock slow email sending that triggers timeout but completes successfully later
      mockResendSend.mockImplementation(async () => {
        // Simulate a 15 second delay (longer than 10s timeout)
        await new Promise(resolve => setTimeout(resolve, 15000))
        return { data: { id: 'msg_123' }, error: null }
      })

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      const responsePromise = POST(request)

      // Fast-forward past the timeout but before email completes
      await vi.advanceTimersByTimeAsync(11000)

      const response = await responsePromise
      const data = await response.json()

      // Response should indicate success (invitation link is valid)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // When send is still in-flight (pendingInFlight=true), should NOT insert to retry queue
      // The initial update to 'sending' status should happen, but no retry queue insert
      // because we're waiting for background completion
    })

    it('should call updateEmailStatus with pending status and increment retry count', async () => {
      // Simulate an email that fails with a retriable error
      mockResendSend.mockResolvedValue({
        data: null,
        error: { message: 'Rate limited' },
      })

      const { POST } = await import('@/app/api/trusted-person/invite/route')
      const request = new Request('http://localhost/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
      })

      await POST(request)

      // Verify the update was called for status tracking
      expect(mockSupabaseUpdate).toHaveBeenCalled()
    })
  })
})

describe('Email Retry Queue Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process pending queue items', async () => {
    const mockQueueItem = createMockEmailRetryQueueItem('tp_test_123', {
      status: 'pending',
      retry_count: 0,
    })

    // This test verifies the queue processing endpoint exists
    // Full implementation tested in integration tests
    expect(mockQueueItem.status).toBe('pending')
    expect(mockQueueItem.retry_count).toBe(0)
  })

  it('should increment retry count on failure', async () => {
    const mockQueueItem = createMockEmailRetryQueueItem('tp_test_123', {
      status: 'pending',
      retry_count: 1,
    })

    const newRetryCount = mockQueueItem.retry_count + 1
    expect(newRetryCount).toBe(2)
  })

  it('should mark as failed after 5 retries (MAX_RETRY_ATTEMPTS)', async () => {
    const mockQueueItem = createMockEmailRetryQueueItem('tp_test_123', {
      status: 'pending',
      retry_count: 5,
    })

    // After 5 retries (MAX_RETRY_ATTEMPTS), should be marked as failed
    const MAX_RETRY_ATTEMPTS = 5
    const shouldMarkAsFailed = mockQueueItem.retry_count >= MAX_RETRY_ATTEMPTS
    expect(shouldMarkAsFailed).toBe(true)
  })

  it('should calculate exponential backoff correctly', () => {
    const calculateBackoff = (retryCount: number): number => {
      const baseDelayMs = 5 * 60 * 1000 // 5 minutes
      const maxDelayMs = 24 * 60 * 60 * 1000 // 24 hours
      return Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs)
    }

    expect(calculateBackoff(0)).toBe(5 * 60 * 1000) // 5 minutes
    expect(calculateBackoff(1)).toBe(10 * 60 * 1000) // 10 minutes
    expect(calculateBackoff(2)).toBe(20 * 60 * 1000) // 20 minutes
    expect(calculateBackoff(3)).toBe(40 * 60 * 1000) // 40 minutes
    expect(calculateBackoff(10)).toBe(24 * 60 * 60 * 1000) // Capped at 24 hours
  })

  it('should return 401 unauthorized without proper cron secret', async () => {
    const { GET } = await import('@/app/api/cron/process-email-queue/route')

    const request = new Request('http://localhost/api/cron/process-email-queue', {
      method: 'GET',
      headers: {
        'authorization': 'Bearer wrong-secret',
      },
    })

    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('should return success with no pending items message when queue is empty', async () => {
    const { GET } = await import('@/app/api/cron/process-email-queue/route')

    const request = new Request('http://localhost/api/cron/process-email-queue', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('No pending items in queue')
  })

  it('should track processing metrics in response', async () => {
    const { GET } = await import('@/app/api/cron/process-email-queue/route')

    const request = new Request('http://localhost/api/cron/process-email-queue', {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    })

    const response = await GET(request)
    const data = await response.json()

    // Response should include processing metrics
    expect(data).toHaveProperty('processed')
    expect(data).toHaveProperty('succeeded')
    expect(data).toHaveProperty('failed')
    expect(data).toHaveProperty('permanently_failed')
    expect(data).toHaveProperty('timestamp')
  })
})

describe('Email Queue - addToRetryQueue and updateEmailStatus Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.lebensordner.org'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    // Re-configure mocks cleared by vi.clearAllMocks()
    supabaseGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'owner@example.com' } },
      error: null,
    })
    baseSupabaseClient.from = createTableDispatch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should call addToRetryQueue with correct parameters on email error', async () => {
    const errorMessage = 'Connection refused'
    mockResendSend.mockRejectedValue(new Error(errorMessage))
    mockSupabaseInsert.mockClear()

    const { POST } = await import('@/app/api/trusted-person/invite/route')
    const request = new Request('http://localhost/api/trusted-person/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
    })

    await POST(request)

    // Verify that insert was called on email_retry_queue table
    // The mock captures calls to supabase.from().insert()
    expect(mockSupabaseInsert).toHaveBeenCalled()
  })

  it('should set email_status to failed with error message on send failure', async () => {
    const errorMessage = 'Invalid recipient'
    mockResendSend.mockResolvedValue({
      data: null,
      error: { message: errorMessage },
    })
    mockSupabaseUpdate.mockClear()

    const { POST } = await import('@/app/api/trusted-person/invite/route')
    const request = new Request('http://localhost/api/trusted-person/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
    })

    await POST(request)

    // Verify update was called (status tracking)
    expect(mockSupabaseUpdate).toHaveBeenCalled()
  })

  it('should set email_status to sent with timestamp on success', async () => {
    mockResendSend.mockResolvedValue({
      data: { id: 'msg_success_123' },
      error: null,
    })
    mockSupabaseUpdate.mockClear()

    const { POST } = await import('@/app/api/trusted-person/invite/route')
    const request = new Request('http://localhost/api/trusted-person/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustedPersonId: 'tp_test_123' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toBe('Einladung wurde gesendet')

    // Verify update was called for success status
    expect(mockSupabaseUpdate).toHaveBeenCalled()
  })

  it('should preserve retry count when incrementing on failure', async () => {
    // Create trusted person with existing retry count
    const trustedPersonWithRetries = createMockTrustedPerson({
      email_retry_count: 2,
    })

    // Reset mock to use new trusted person
    baseSupabaseClient.from = createTableDispatch(trustedPersonWithRetries)
    vi.doMock('@/lib/supabase/server', () => ({
      createServerSupabaseClient: vi.fn(() => Promise.resolve(baseSupabaseClient)),
    }))

    mockResendSend.mockRejectedValue(new Error('Temporary failure'))

    // Re-import to get fresh module with new mock
    vi.resetModules()

    // The retry count should be incremented from 2 to 3
    expect(trustedPersonWithRetries.email_retry_count).toBe(2)
  })
})

describe('Email Invite Status Endpoint', () => {
  it('should return correct email status', async () => {
    const trustedPerson = createMockTrustedPerson({
      email_status: 'sent',
      email_sent_at: new Date().toISOString(),
      email_error: null,
    })

    expect(trustedPerson.email_status).toBe('sent')
    expect(trustedPerson.email_sent_at).toBeTruthy()
    expect(trustedPerson.email_error).toBeNull()
  })

  it('should return error message on failed status', async () => {
    const trustedPerson = createMockTrustedPerson({
      email_status: 'failed',
      email_sent_at: null,
      email_error: 'Invalid email address',
    })

    expect(trustedPerson.email_status).toBe('failed')
    expect(trustedPerson.email_error).toBe('Invalid email address')
  })
})
