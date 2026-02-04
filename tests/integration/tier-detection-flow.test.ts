import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getTierFromSubscription,
  SUBSCRIPTION_TIERS,
  getStripePriceIds,
} from '@/lib/subscription-tiers'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_FAMILY_MONTHLY,
  STRIPE_PRICE_FAMILY_YEARLY,
  STRIPE_PRICE_UNKNOWN,
  createMockSubscription,
  createMockWebhookEvent,
  createProfileWithSubscription,
} from '../fixtures/stripe'

/**
 * Integration tests simulating the complete tier detection flow:
 * 1. Stripe webhook event received
 * 2. Profile updated in database with stripe_price_id
 * 3. Client fetches profile data
 * 4. getTierFromSubscription determines tier
 * 5. UI displays correct tier name
 */
describe('Tier Detection Integration Flow', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete flow: Webhook -> Database -> Client -> getTierFromSubscription -> UI', () => {
    /**
     * Simulates the complete tier detection flow
     */
    function simulateTierDetectionFlow(priceId: string | null, status: string = 'active') {
      // Step 1: Webhook extracts price ID from Stripe subscription
      const subscription = priceId ? createMockSubscription(priceId, status as any) : {
        ...createMockSubscription('', status as any),
        items: { data: [] },
      }
      const extractedPriceId = subscription.items.data[0]?.price?.id || null

      // Step 2: Profile is updated in database
      const profileData = createProfileWithSubscription(extractedPriceId, status)

      // Step 3: Client fetches profile
      const clientProfile = {
        subscription_status: profileData.subscription_status,
        stripe_price_id: profileData.stripe_price_id,
      }

      // Step 4: getTierFromSubscription determines tier
      const tier = getTierFromSubscription(
        clientProfile.subscription_status,
        clientProfile.stripe_price_id
      )

      // Step 5: Return tier for UI display
      return {
        extractedPriceId,
        profileData,
        clientProfile,
        tier,
        tierName: tier.name,
        tierId: tier.id,
      }
    }

    it('should correctly identify Basic monthly user through entire flow', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_BASIC_MONTHLY)

      expect(result.extractedPriceId).toBe(STRIPE_PRICE_BASIC_MONTHLY)
      expect(result.tierId).toBe('basic')
      expect(result.tierName).toBe('Basis')
    })

    it('should correctly identify Basic yearly user through entire flow', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_BASIC_YEARLY)

      expect(result.extractedPriceId).toBe(STRIPE_PRICE_BASIC_YEARLY)
      expect(result.tierId).toBe('basic')
      expect(result.tierName).toBe('Basis')
    })

    it('should correctly identify Premium monthly user through entire flow', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(result.extractedPriceId).toBe(STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(result.tierId).toBe('premium')
      expect(result.tierName).toBe('Premium')
    })

    it('should correctly identify Premium yearly user through entire flow', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_PREMIUM_YEARLY)

      expect(result.extractedPriceId).toBe(STRIPE_PRICE_PREMIUM_YEARLY)
      expect(result.tierId).toBe('premium')
      expect(result.tierName).toBe('Premium')
    })

    it('should correctly identify Family monthly user as Premium through entire flow', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_FAMILY_MONTHLY)

      expect(result.extractedPriceId).toBe(STRIPE_PRICE_FAMILY_MONTHLY)
      expect(result.tierId).toBe('premium')
      expect(result.tierName).toBe('Premium')
      // Verify full premium features are available
      expect(result.tier.limits.maxDocuments).toBe(-1) // unlimited
      expect(result.tier.limits.smsNotifications).toBe(true)
      expect(result.tier.limits.familyDashboard).toBe(true)
    })

    it('should correctly identify Family yearly user as Premium through entire flow', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_FAMILY_YEARLY)

      expect(result.extractedPriceId).toBe(STRIPE_PRICE_FAMILY_YEARLY)
      expect(result.tierId).toBe('premium')
      expect(result.tierName).toBe('Premium')
    })

    it('should handle unknown price ID with safe fallback to Basic', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_UNKNOWN)

      expect(result.extractedPriceId).toBe(STRIPE_PRICE_UNKNOWN)
      expect(result.tierId).toBe('basic')
      expect(result.tierName).toBe('Basis')
      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unrecognized price ID')
      )
    })

    it('should handle missing price ID with safe fallback to Basic', () => {
      const result = simulateTierDetectionFlow(null)

      expect(result.extractedPriceId).toBeNull()
      expect(result.tierId).toBe('basic')
      expect(result.tierName).toBe('Basis')
      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing price ID')
      )
    })

    it('should return Free tier for canceled subscription', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_PREMIUM_MONTHLY, 'canceled')

      expect(result.tierId).toBe('free')
      expect(result.tierName).toBe('Kostenlos')
    })

    it('should return Free tier for null subscription status', () => {
      const tier = getTierFromSubscription(null, STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(tier.id).toBe('free')
      expect(tier.name).toBe('Kostenlos')
    })

    it('should handle trialing status with Premium price', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_PREMIUM_MONTHLY, 'trialing')

      expect(result.tierId).toBe('premium')
      expect(result.tierName).toBe('Premium')
    })

    it('should handle trialing status with Family price', () => {
      const result = simulateTierDetectionFlow(STRIPE_PRICE_FAMILY_MONTHLY, 'trialing')

      expect(result.tierId).toBe('premium')
      expect(result.tierName).toBe('Premium')
    })
  })

  describe('Price ID configuration consistency', () => {
    it('should have all required environment variables set in test', () => {
      const priceIds = getStripePriceIds()

      expect(priceIds.basic.monthly).toBe(STRIPE_PRICE_BASIC_MONTHLY)
      expect(priceIds.basic.yearly).toBe(STRIPE_PRICE_BASIC_YEARLY)
      expect(priceIds.premium.monthly).toBe(STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(priceIds.premium.yearly).toBe(STRIPE_PRICE_PREMIUM_YEARLY)
      expect(priceIds.family.monthly).toBe(STRIPE_PRICE_FAMILY_MONTHLY)
      expect(priceIds.family.yearly).toBe(STRIPE_PRICE_FAMILY_YEARLY)
    })

    it('should match test fixtures with environment variables', () => {
      expect(process.env.STRIPE_PRICE_BASIC_MONTHLY).toBe(STRIPE_PRICE_BASIC_MONTHLY)
      expect(process.env.STRIPE_PRICE_BASIC_YEARLY).toBe(STRIPE_PRICE_BASIC_YEARLY)
      expect(process.env.STRIPE_PRICE_PREMIUM_MONTHLY).toBe(STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(process.env.STRIPE_PRICE_PREMIUM_YEARLY).toBe(STRIPE_PRICE_PREMIUM_YEARLY)
      expect(process.env.STRIPE_PRICE_FAMILY_MONTHLY).toBe(STRIPE_PRICE_FAMILY_MONTHLY)
      expect(process.env.STRIPE_PRICE_FAMILY_YEARLY).toBe(STRIPE_PRICE_FAMILY_YEARLY)
    })
  })

  describe('Tier feature verification', () => {
    it('Premium tier should have all premium features', () => {
      const tier = SUBSCRIPTION_TIERS.premium

      expect(tier.limits.maxDocuments).toBe(-1) // unlimited
      expect(tier.limits.maxStorageMB).toBe(4096)
      expect(tier.limits.maxTrustedPersons).toBe(5)
      expect(tier.limits.emailReminders).toBe(true)
      expect(tier.limits.documentExpiry).toBe(true)
      expect(tier.limits.twoFactorAuth).toBe(true)
      expect(tier.limits.prioritySupport).toBe(true)
      expect(tier.limits.smsNotifications).toBe(true)
      expect(tier.limits.familyDashboard).toBe(true)
      expect(tier.limits.customCategories).toBe(true)
    })

    it('Basic tier should have limited features', () => {
      const tier = SUBSCRIPTION_TIERS.basic

      expect(tier.limits.maxDocuments).toBe(50)
      expect(tier.limits.maxStorageMB).toBe(500)
      expect(tier.limits.maxTrustedPersons).toBe(3)
      expect(tier.limits.emailReminders).toBe(true)
      expect(tier.limits.documentExpiry).toBe(true)
      expect(tier.limits.twoFactorAuth).toBe(false) // Not in basic
      expect(tier.limits.prioritySupport).toBe(false) // Not in basic
      expect(tier.limits.smsNotifications).toBe(false) // Not in basic
      expect(tier.limits.familyDashboard).toBe(true)
      expect(tier.limits.customCategories).toBe(true)
    })

    it('Free tier should have minimal features', () => {
      const tier = SUBSCRIPTION_TIERS.free

      expect(tier.limits.maxDocuments).toBe(10)
      expect(tier.limits.maxStorageMB).toBe(100)
      expect(tier.limits.maxTrustedPersons).toBe(1)
      expect(tier.limits.emailReminders).toBe(false)
      expect(tier.limits.documentExpiry).toBe(false)
      expect(tier.limits.twoFactorAuth).toBe(false)
      expect(tier.limits.prioritySupport).toBe(false)
      expect(tier.limits.smsNotifications).toBe(false)
      expect(tier.limits.familyDashboard).toBe(false)
      expect(tier.limits.customCategories).toBe(false)
    })

    it('Family tier users should get all Premium features', () => {
      const familyTier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)
      const premiumTier = SUBSCRIPTION_TIERS.premium

      // Family users get the exact same tier config as Premium users
      expect(familyTier).toEqual(premiumTier)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty string subscription status', () => {
      const tier = getTierFromSubscription('', STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(tier.id).toBe('free')
    })

    it('should handle whitespace-only price ID', () => {
      const tier = getTierFromSubscription('active', '   ')

      expect(tier.id).toBe('basic') // Safe default
      expect(console.warn).toHaveBeenCalled()
    })

    it('should handle price ID with extra characters', () => {
      // Real price ID with typo
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY + '_extra')

      expect(tier.id).toBe('basic') // Safe default
    })

    it('should handle past_due status', () => {
      // past_due is not active or trialing, so should return based on price ID match
      const tier = getTierFromSubscription('past_due', STRIPE_PRICE_PREMIUM_MONTHLY)

      // past_due should still match by price ID
      expect(tier.id).toBe('premium')
    })

    it('should handle unpaid status', () => {
      const tier = getTierFromSubscription('unpaid', STRIPE_PRICE_PREMIUM_MONTHLY)

      // unpaid should still match by price ID
      expect(tier.id).toBe('premium')
    })
  })
})

describe('Webhook to UI Data Flow Verification', () => {
  it('should preserve price ID through entire data flow', () => {
    // Simulate webhook receiving subscription event
    const mockWebhookData = {
      subscription: createMockSubscription(STRIPE_PRICE_FAMILY_MONTHLY, 'active'),
    }

    // Extract price ID as webhook would
    const extractedPriceId = mockWebhookData.subscription.items.data[0]?.price?.id

    // Verify extraction
    expect(extractedPriceId).toBe(STRIPE_PRICE_FAMILY_MONTHLY)

    // Simulate database update payload
    const dbUpdatePayload = {
      stripe_price_id: extractedPriceId,
      subscription_status: mockWebhookData.subscription.status,
    }

    // Verify payload
    expect(dbUpdatePayload.stripe_price_id).toBe(STRIPE_PRICE_FAMILY_MONTHLY)
    expect(dbUpdatePayload.subscription_status).toBe('active')

    // Simulate client fetching this data
    const clientData = { ...dbUpdatePayload }

    // Verify tier detection
    const tier = getTierFromSubscription(
      clientData.subscription_status,
      clientData.stripe_price_id
    )

    expect(tier.id).toBe('premium')
    expect(tier.name).toBe('Premium')
  })

  it('should handle subscription upgrade flow', () => {
    // User starts with Basic
    const basicTier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)
    expect(basicTier.id).toBe('basic')

    // User upgrades to Premium
    const premiumTier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)
    expect(premiumTier.id).toBe('premium')

    // User switches to Family plan
    const familyTier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)
    expect(familyTier.id).toBe('premium') // Family is treated as Premium
  })

  it('should handle subscription downgrade flow', () => {
    // User starts with Premium
    const premiumTier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)
    expect(premiumTier.id).toBe('premium')

    // User downgrades to Basic
    const basicTier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)
    expect(basicTier.id).toBe('basic')

    // User cancels
    const freeTier = getTierFromSubscription('canceled', STRIPE_PRICE_BASIC_MONTHLY)
    expect(freeTier.id).toBe('free')
  })
})
