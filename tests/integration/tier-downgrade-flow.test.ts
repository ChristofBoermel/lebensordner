import { describe, it, expect } from 'vitest'
import {
  getTierFromSubscription,
  SUBSCRIPTION_TIERS,
  canPerformAction,
  canUploadFile,
  hasFeatureAccess,
} from '@/lib/subscription-tiers'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY_MIXEDCASE,
  createMockSubscription,
  createMockSubscriptionWithCaseVariation,
  createMockWebhookEvent,
  createProfileWithSubscription,
  createSubscriptionDeletedWebhook,
} from '../fixtures/stripe'

describe('Tier Downgrade Flow Integration', () => {
  describe('Webhook to Database to Tier Detection', () => {
    it('customer.subscription.deleted webhook -> database update -> tier detection returns free', () => {
      const webhookEvent = createSubscriptionDeletedWebhook('cus_test', 'sub_test')
      const subscription = webhookEvent.data.object

      const profileData = createProfileWithSubscription(null, 'canceled')
      profileData.stripe_customer_id = subscription.customer as string

      const tier = getTierFromSubscription(profileData.subscription_status, profileData.stripe_price_id)

      expect(tier.id).toBe('free')
    })

    it('customer.subscription.updated webhook -> database update -> tier detection reflects new tier', () => {
      const subscription = createMockSubscription(STRIPE_PRICE_BASIC_MONTHLY, 'active')
      const webhookEvent = createMockWebhookEvent('customer.subscription.updated', {
        ...subscription,
        customer: 'cus_test',
        metadata: { supabase_user_id: 'test-user-id' },
      })

      const extractedPriceId = webhookEvent.data.object.items.data[0].price.id
      const profileData = createProfileWithSubscription(extractedPriceId, 'active')

      const tier = getTierFromSubscription(profileData.subscription_status, profileData.stripe_price_id)

      expect(tier.id).toBe('basic')
    })

    it('subscription reactivation flow (free -> premium)', () => {
      const canceledProfile = createProfileWithSubscription(null, 'canceled')
      const freeTier = getTierFromSubscription(canceledProfile.subscription_status, canceledProfile.stripe_price_id)

      const activeSubscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY, 'active')
      const reactivatedProfile = createProfileWithSubscription(
        activeSubscription.items.data[0].price.id,
        'active'
      )
      const premiumTier = getTierFromSubscription(reactivatedProfile.subscription_status, reactivatedProfile.stripe_price_id)

      expect(freeTier.id).toBe('free')
      expect(premiumTier.id).toBe('premium')
    })

    it('case-insensitive price ID in webhook -> database -> tier detection flow', () => {
      const subscription = createMockSubscriptionWithCaseVariation(STRIPE_PRICE_PREMIUM_MONTHLY, 'mixed', 'active')
      const webhookEvent = createMockWebhookEvent('customer.subscription.updated', {
        ...subscription,
        customer: 'cus_test',
        metadata: { supabase_user_id: 'test-user-id' },
      })

      const extractedPriceId = webhookEvent.data.object.items.data[0].price.id
      const profileData = createProfileWithSubscription(extractedPriceId, 'active')

      const tier = getTierFromSubscription(profileData.subscription_status, profileData.stripe_price_id)

      expect(tier.id).toBe('premium')
    })

    it('tier detection with mixed-case price ID from Stripe webhook', () => {
      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_MONTHLY_MIXEDCASE, 'active')
      const webhookEvent = createMockWebhookEvent('customer.subscription.updated', {
        ...subscription,
        customer: 'cus_test',
        metadata: { supabase_user_id: 'test-user-id' },
      })

      const extractedPriceId = webhookEvent.data.object.items.data[0].price.id
      const profileData = createProfileWithSubscription(extractedPriceId, 'active')

      const tier = getTierFromSubscription(profileData.subscription_status, profileData.stripe_price_id)

      expect(tier.id).toBe('premium')
    })

    it('subscription update with case mismatch between webhook and environment', () => {
      const originalPremiumYearly = process.env.STRIPE_PRICE_PREMIUM_YEARLY
      process.env.STRIPE_PRICE_PREMIUM_YEARLY = STRIPE_PRICE_PREMIUM_YEARLY.toUpperCase()

      const subscription = createMockSubscription(STRIPE_PRICE_PREMIUM_YEARLY.toLowerCase(), 'active')
      const webhookEvent = createMockWebhookEvent('customer.subscription.updated', {
        ...subscription,
        customer: 'cus_test',
        metadata: { supabase_user_id: 'test-user-id' },
      })

      const extractedPriceId = webhookEvent.data.object.items.data[0].price.id
      const profileData = createProfileWithSubscription(extractedPriceId, 'active')

      const tier = getTierFromSubscription(profileData.subscription_status, profileData.stripe_price_id)

      expect(tier.id).toBe('premium')

      process.env.STRIPE_PRICE_PREMIUM_YEARLY = originalPremiumYearly
    })
  })

  describe('Feature Restrictions After Downgrade', () => {
    it('document upload limits enforced after downgrade (premium -> free: unlimited -> 10)', () => {
      const premiumTier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)
      const freeTier = getTierFromSubscription('canceled', STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(canPerformAction(premiumTier, 'uploadDocument', 999)).toBe(true)
      expect(canPerformAction(freeTier, 'uploadDocument', 10)).toBe(false)
    })

    it('storage limits enforced after downgrade (4GB -> 100MB)', () => {
      const premiumTier = SUBSCRIPTION_TIERS.premium
      const freeTier = SUBSCRIPTION_TIERS.free

      expect(canUploadFile(premiumTier, 4000, 50).allowed).toBe(true)
      expect(canUploadFile(freeTier, 95, 10).allowed).toBe(false)
    })

    it('trusted person limits enforced after downgrade (5 -> 0)', () => {
      const premiumTier = SUBSCRIPTION_TIERS.premium
      const freeTier = SUBSCRIPTION_TIERS.free

      expect(canPerformAction(premiumTier, 'addTrustedPerson', 4)).toBe(true)
      expect(canPerformAction(freeTier, 'addTrustedPerson', 0)).toBe(false)
    })

    it('email reminder restrictions enforced after downgrade (enabled -> disabled)', () => {
      const premiumTier = SUBSCRIPTION_TIERS.premium
      const freeTier = SUBSCRIPTION_TIERS.free

      expect(hasFeatureAccess(premiumTier, 'emailReminders')).toBe(true)
      expect(hasFeatureAccess(freeTier, 'emailReminders')).toBe(false)
    })

    it('2FA restrictions enforced after downgrade (enabled -> disabled)', () => {
      const premiumTier = SUBSCRIPTION_TIERS.premium
      const freeTier = SUBSCRIPTION_TIERS.free

      expect(hasFeatureAccess(premiumTier, 'twoFactorAuth')).toBe(true)
      expect(hasFeatureAccess(freeTier, 'twoFactorAuth')).toBe(false)
    })
  })

  describe('Tier Upgrade Flow', () => {
    it('free -> basic upgrade unlocks features', () => {
      const freeTier = getTierFromSubscription(null, null)
      const basicTier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)

      expect(canPerformAction(freeTier, 'uploadDocument', 10)).toBe(false)
      expect(canPerformAction(basicTier, 'uploadDocument', 10)).toBe(true)
      expect(hasFeatureAccess(basicTier, 'emailReminders')).toBe(true)
    })

    it('basic -> premium upgrade unlocks features', () => {
      const basicTier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)
      const premiumTier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_YEARLY)

      expect(hasFeatureAccess(basicTier, 'twoFactorAuth')).toBe(false)
      expect(hasFeatureAccess(premiumTier, 'twoFactorAuth')).toBe(true)
      expect(canUploadFile(basicTier, 500, 1).allowed).toBe(false)
      expect(canUploadFile(premiumTier, 500, 1).allowed).toBe(true)
    })
  })
})
