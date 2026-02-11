import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  STRIPE_PRICE_INVALID,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_MONTHLY_UPPERCASE,
  STRIPE_PRICE_PREMIUM_MONTHLY_MIXEDCASE,
  STRIPE_PRICE_UNKNOWN,
  createMockSubscription,
  createMockWebhookEvent,
} from '../fixtures/stripe'

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
    from: vi.fn(() => ({
      update: mockSupabaseUpdate,
      select: mockSupabaseSelect,
    })),
  })),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve({
    get: vi.fn(() => 'test-signature'),
  })),
}))

describe('Stripe Webhook Edge Cases', () => {
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

  describe('Malformed Data', () => {
    it('handles webhook with malformed price ID', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_INVALID, 'active')
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
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_price_id: STRIPE_PRICE_INVALID })
      )
    })

    it('handles webhook with missing subscription_id', async () => {
      const { stripe } = await import('@/lib/stripe')
      const session = {
        id: 'cs_test_missing_sub',
        customer: 'cus_test',
        subscription: null,
        metadata: { supabase_user_id: 'test-user-id' },
        mode: 'subscription',
        payment_status: 'paid',
      }

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('checkout.session.completed', session) as any
      )

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(session),
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
    })

    it('handles webhook with missing customer ID', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_UNKNOWN, 'active')
      ;(subscription as any).customer = null
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
      expect(mockSupabaseUpdate).toHaveBeenCalled()
    })

    it('handles webhook with empty items.data array', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = {
        id: 'sub_test_empty_items',
        status: 'active',
        customer: 'cus_test',
        metadata: { supabase_user_id: 'test-user-id' },
        items: { data: [] },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      }

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
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_price_id: null })
      )
    })

    it('handles webhook with uppercase price ID when env var is lowercase', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY_UPPERCASE, 'active')
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
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY_UPPERCASE })
      )
    })

    it('handles webhook with lowercase price ID when env var is uppercase', async () => {
      const originalPremiumMonthly = process.env.STRIPE_PRICE_PREMIUM_MONTHLY
      process.env.STRIPE_PRICE_PREMIUM_MONTHLY = STRIPE_PRICE_PREMIUM_MONTHLY_UPPERCASE

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
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY })
      )

      process.env.STRIPE_PRICE_PREMIUM_MONTHLY = originalPremiumMonthly
    })
  })

  describe('Concurrent Operations', () => {
    it('handles duplicate webhook delivery idempotently', async () => {
      const { stripe } = await import('@/lib/stripe')
      const subscription = createMockSubscription(STRIPE_PRICE_UNKNOWN, 'active')
      ;(subscription as any).customer = 'cus_test'
      ;(subscription as any).metadata = { supabase_user_id: 'test-user-id' }

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const mockedEvent = createMockWebhookEvent('customer.subscription.updated', subscription)

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockedEvent as any)
      const firstResponse = await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }))

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockedEvent as any)
      const secondResponse = await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }))

      expect(firstResponse.status).toBe(200)
      expect(secondResponse.status).toBe(200)
      expect(mockSupabaseUpdate).toHaveBeenCalledTimes(2)
      const lastCall = mockSupabaseUpdate.mock.calls[mockSupabaseUpdate.mock.calls.length - 1][0]
      expect(lastCall).toEqual(expect.objectContaining({ stripe_price_id: STRIPE_PRICE_UNKNOWN }))
    })

    it('handles concurrent subscription updates', async () => {
      const { stripe } = await import('@/lib/stripe')
      const firstSubscription = createMockSubscription(STRIPE_PRICE_UNKNOWN, 'active')
      ;(firstSubscription as any).customer = 'cus_test'
      ;(firstSubscription as any).metadata = { supabase_user_id: 'test-user-id' }

      const secondSubscription = createMockSubscription(STRIPE_PRICE_INVALID, 'active')
      ;(secondSubscription as any).customer = 'cus_test'
      ;(secondSubscription as any).metadata = { supabase_user_id: 'test-user-id' }

      const { POST } = await import('@/app/api/stripe/webhook/route')

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', firstSubscription) as any
      )
      await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(firstSubscription),
      }))

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', secondSubscription) as any
      )
      await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(secondSubscription),
      }))

      const lastCall = mockSupabaseUpdate.mock.calls[mockSupabaseUpdate.mock.calls.length - 1][0]
      expect(lastCall).toEqual(expect.objectContaining({ stripe_price_id: STRIPE_PRICE_INVALID }))
    })

    it('handles rapid subscription status changes (active -> canceled -> active)', async () => {
      const { stripe } = await import('@/lib/stripe')
      const activeSubscription = createMockSubscription(STRIPE_PRICE_UNKNOWN, 'active')
      ;(activeSubscription as any).customer = 'cus_test'
      ;(activeSubscription as any).metadata = { supabase_user_id: 'test-user-id' }

      const canceledSubscription = createMockSubscription(STRIPE_PRICE_UNKNOWN, 'canceled')
      ;(canceledSubscription as any).customer = 'cus_test'
      ;(canceledSubscription as any).metadata = { supabase_user_id: 'test-user-id' }

      const { POST } = await import('@/app/api/stripe/webhook/route')

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', activeSubscription) as any
      )
      await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(activeSubscription),
      }))

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.deleted', canceledSubscription) as any
      )
      await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(canceledSubscription),
      }))

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', activeSubscription) as any
      )
      await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(activeSubscription),
      }))

      const lastCall = mockSupabaseUpdate.mock.calls[mockSupabaseUpdate.mock.calls.length - 1][0]
      expect(lastCall).toEqual(expect.objectContaining({ subscription_status: 'active' }))
      expect(mockSupabaseUpdate).toHaveBeenCalledTimes(3)
    })

    it('handles concurrent webhooks with different case variations of the same price ID', async () => {
      const { stripe } = await import('@/lib/stripe')
      const firstSubscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY_UPPERCASE, 'active')
      ;(firstSubscription as any).customer = 'cus_test'
      ;(firstSubscription as any).metadata = { supabase_user_id: 'test-user-id' }

      const secondSubscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY_MIXEDCASE, 'active')
      ;(secondSubscription as any).customer = 'cus_test'
      ;(secondSubscription as any).metadata = { supabase_user_id: 'test-user-id' }

      const { POST } = await import('@/app/api/stripe/webhook/route')

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', firstSubscription) as any
      )
      await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(firstSubscription),
      }))

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        createMockWebhookEvent('customer.subscription.updated', secondSubscription) as any
      )
      await POST(new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify(secondSubscription),
      }))

      const lastCall = mockSupabaseUpdate.mock.calls[mockSupabaseUpdate.mock.calls.length - 1][0]
      expect(lastCall).toEqual(expect.objectContaining({ stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY_MIXEDCASE }))
    })
  })

  describe('Webhook Validation', () => {
    it('returns 400 for signature validation failure', async () => {
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

    it('handles invalid event type gracefully', async () => {
      const { stripe } = await import('@/lib/stripe')
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'evt_invalid',
      })
      ;(event as any).type = 'customer.subscription.paused'

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(event as any)

      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockSupabaseUpdate).not.toHaveBeenCalled()
    })
  })
})
