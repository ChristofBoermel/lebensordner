import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export const getStripe = () => {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  }
  return stripeInstance
}

// Legacy export for backwards compatibility (lazy initialized)
export const stripe = {
  get customers() { return getStripe().customers },
  get subscriptions() { return getStripe().subscriptions },
  get checkout() { return getStripe().checkout },
  get billingPortal() { return getStripe().billingPortal },
  get prices() { return getStripe().prices },
  get webhooks() { return getStripe().webhooks },
}

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
