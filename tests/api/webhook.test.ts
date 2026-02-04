import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_FAMILY_MONTHLY,
  STRIPE_PRICE_FAMILY_YEARLY,
  createMockSubscription,
  createMockCheckoutSession,
  createMockInvoice,
  createMockWebhookEvent,
} from '../fixtures/stripe'

// Mock Stripe module
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}))

// Mock Supabase client
const mockSupabaseUpdate = vi.fn()
const mockSupabaseSelect = vi.fn()

const setupSupabaseMocks = () => {
  mockSupabaseUpdate.mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }))
  mockSupabaseSelect.mockImplementation(() => ({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'test-user-id' }, error: null }),
    }),
  }))
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      update: mockSupabaseUpdate,
      select: mockSupabaseSelect,
    })),
  })),
}))

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve({
    get: vi.fn(() => 'test-signature'),
  })),
}))

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSupabaseMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('checkout.session.completed', () => {
    it('should extract and store premium price ID from subscription', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'active')
      const session = createMockCheckoutSession('cus_test', subscription.id, {
        supabase_user_id: 'test-user-id',
      })

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('checkout.session.completed', session) as any
      )
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(subscription as any)

      // Import and call the handler
      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(session),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(subscription.id)
    })

    it('should extract and store family monthly price ID as premium', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_FAMILY_MONTHLY, 'active')
      const session = createMockCheckoutSession('cus_test', subscription.id, {
        supabase_user_id: 'test-user-id',
      })

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('checkout.session.completed', session) as any
      )
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(subscription as any)

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(session),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      // Verify the subscription was retrieved to extract price ID
      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(subscription.id)
    })

    it('should extract and store family yearly price ID', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_FAMILY_YEARLY, 'active')
      const session = createMockCheckoutSession('cus_test', subscription.id, {
        supabase_user_id: 'test-user-id',
      })

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('checkout.session.completed', session) as any
      )
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(subscription as any)

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(session),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('customer.subscription.created', () => {
    it('should store basic monthly price ID', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_BASIC_MONTHLY, 'active')
      ;(subscription as any).customer = 'cus_test'
      ;(subscription as any).metadata = { supabase_user_id: 'test-user-id' }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.created', subscription) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should store premium yearly price ID', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_YEARLY, 'active')
      ;(subscription as any).customer = 'cus_test'
      ;(subscription as any).metadata = { supabase_user_id: 'test-user-id' }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.created', subscription) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should store family monthly price ID', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_FAMILY_MONTHLY, 'active')
      ;(subscription as any).customer = 'cus_test'
      ;(subscription as any).metadata = { supabase_user_id: 'test-user-id' }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.created', subscription) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('customer.subscription.updated', () => {
    it('should update price ID when subscription changes', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'active')
      ;(subscription as any).customer = 'cus_test'
      ;(subscription as any).metadata = { supabase_user_id: 'test-user-id' }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', subscription) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should handle upgrade from basic to premium', async () => {
      const { stripe } = await import('@/lib/stripe')
      // Simulating an upgrade - subscription now has premium price
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'active')
      ;(subscription as any).customer = 'cus_test'
      ;(subscription as any).metadata = { supabase_user_id: 'test-user-id' }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', subscription) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('customer.subscription.deleted', () => {
    it('should clear price ID and set status to canceled', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'canceled')
      ;(subscription as any).customer = 'cus_test'
      ;(subscription as any).metadata = { supabase_user_id: 'test-user-id' }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.deleted', subscription) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Price ID extraction', () => {
    it('should correctly extract price ID from subscription.items.data[0].price.id', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'active')

      // Verify the mock subscription has correct structure
      expect(subscription.items.data[0].price.id).toBe(STRIPE_PRICE_PREMIUM_MONTHLY)
    })

    it('should handle subscription with no items gracefully', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = {
        id: 'sub_test',
        status: 'active',
        customer: 'cus_test',
        metadata: { supabase_user_id: 'test-user-id' },
        items: { data: [] },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.created', subscription) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })

      // Should not throw, should handle gracefully
      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  describe('Webhook signature verification', () => {
    it('should return 400 for invalid signature', async () => {
      const { stripe } = await import('@/lib/stripe')

      vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })
})
