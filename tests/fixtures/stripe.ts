// Stripe price ID test constants
// These must match the environment variables set in tests/setup.ts

export const STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly_test'
export const STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly_test'
export const STRIPE_PRICE_PREMIUM_MONTHLY = 'price_premium_monthly_test'
export const STRIPE_PRICE_PREMIUM_YEARLY = 'price_premium_yearly_test'

// Family tier price IDs (treated as premium tier for feature access)
export const STRIPE_PRICE_FAMILY_MONTHLY = 'price_family_monthly_test'
export const STRIPE_PRICE_FAMILY_YEARLY = 'price_family_yearly_test'

// Legacy price ID (for backwards compatibility testing)
export const STRIPE_PRICE_ID_LEGACY = 'price_premium_monthly_test'

// Invalid/unknown price IDs for edge case testing
export const STRIPE_PRICE_UNKNOWN = 'price_unknown_12345'
export const STRIPE_PRICE_INVALID = 'invalid_price_id'

// Mock subscription objects
export interface MockStripeSubscription {
  id: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  current_period_start: number
  current_period_end: number
  items: {
    data: Array<{
      price: {
        id: string
        product: string
      }
    }>
  }
}

export function createMockSubscription(
  priceId: string,
  status: MockStripeSubscription['status'] = 'active'
): MockStripeSubscription {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: `sub_test_${Date.now()}`,
    status,
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60, // 30 days from now
    items: {
      data: [
        {
          price: {
            id: priceId,
            product: `prod_${priceId}`,
          },
        },
      ],
    },
  }
}

// Helper to create profile data for testing
export function createProfileWithSubscription(
  priceId: string | null,
  status: string | null = 'active'
) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    full_name: 'Test User',
    subscription_status: status,
    stripe_price_id: priceId,
    stripe_customer_id: priceId ? `cus_test_${Date.now()}` : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// Test scenarios
export const testScenarios = {
  freeUser: createProfileWithSubscription(null, null),
  basicMonthlyUser: createProfileWithSubscription(STRIPE_PRICE_BASIC_MONTHLY, 'active'),
  basicYearlyUser: createProfileWithSubscription(STRIPE_PRICE_BASIC_YEARLY, 'active'),
  premiumMonthlyUser: createProfileWithSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'active'),
  premiumYearlyUser: createProfileWithSubscription(STRIPE_PRICE_PREMIUM_YEARLY, 'active'),
  familyMonthlyUser: createProfileWithSubscription(STRIPE_PRICE_FAMILY_MONTHLY, 'active'),
  familyYearlyUser: createProfileWithSubscription(STRIPE_PRICE_FAMILY_YEARLY, 'active'),
  canceledUser: createProfileWithSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'canceled'),
  trialingUser: createProfileWithSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'trialing'),
  unknownPriceUser: createProfileWithSubscription(STRIPE_PRICE_UNKNOWN, 'active'),
  missingPriceUser: createProfileWithSubscription(null, 'active'),
}

// Stripe webhook event types for testing
export type WebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'

// Helper to create mock Stripe webhook events
export function createMockWebhookEvent(
  type: WebhookEventType,
  data: Record<string, any>
): { id: string; type: WebhookEventType; data: { object: Record<string, any> } } {
  return {
    id: `evt_test_${Date.now()}`,
    type,
    data: {
      object: data,
    },
  }
}

// Helper to create mock checkout session
export function createMockCheckoutSession(
  customerId: string,
  subscriptionId: string,
  metadata?: Record<string, string>
) {
  return {
    id: `cs_test_${Date.now()}`,
    customer: customerId,
    subscription: subscriptionId,
    metadata: metadata || {},
    mode: 'subscription',
    payment_status: 'paid',
  }
}

// Helper to create mock invoice
export function createMockInvoice(
  customerId: string,
  subscriptionId: string,
  status: 'paid' | 'open' | 'void' | 'uncollectible' = 'paid'
) {
  return {
    id: `in_test_${Date.now()}`,
    customer: customerId,
    subscription: subscriptionId,
    status,
    amount_paid: status === 'paid' ? 1190 : 0,
  }
}
