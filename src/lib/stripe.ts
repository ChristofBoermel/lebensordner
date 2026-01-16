import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
})

// Price ID for monthly subscription - create in Stripe Dashboard
export const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_xxx'

// Subscription status types
export type SubscriptionStatus = 
  | 'active' 
  | 'trialing' 
  | 'past_due' 
  | 'canceled' 
  | 'unpaid' 
  | 'incomplete'
  | 'incomplete_expired'

export const isActiveSubscription = (status: SubscriptionStatus | null): boolean => {
  return status === 'active' || status === 'trialing'
}
