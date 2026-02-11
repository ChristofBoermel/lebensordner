import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getTierFromSubscription,
  SUBSCRIPTION_TIERS,
  allowsFamilyDownloads,
  getTierDisplayInfo,
  getDownloadLinkType,
  getStripePriceIds,
} from '@/lib/subscription-tiers'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION,
  STRIPE_PRICE_FAMILY_MONTHLY,
  STRIPE_PRICE_FAMILY_YEARLY,
  STRIPE_PRICE_UNKNOWN,
} from './fixtures/stripe'

describe('getTierFromSubscription', () => {
  describe('Premium Tier Detection', () => {
    it('should return premium tier for active subscription with premium monthly price', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(tier.id).toBe('premium')
      expect(tier.name).toBe('Premium')
      expect(tier.limits.familyDashboard).toBe(true)
      expect(tier.limits.maxDocuments).toBe(-1) // unlimited
    })

    it('should return premium tier for active subscription with premium yearly price', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_YEARLY)

      expect(tier.id).toBe('premium')
      expect(tier.name).toBe('Premium')
    })

    it('should return premium tier for trialing subscription with premium price', () => {
      const tier = getTierFromSubscription('trialing', STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(tier.id).toBe('premium')
    })

    it('should return premium tier for active subscription with production premium monthly price', () => {
      const originalPremiumMonthly = process.env.STRIPE_PRICE_PREMIUM_MONTHLY
      process.env.STRIPE_PRICE_PREMIUM_MONTHLY = STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION

      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION)

      expect(tier.id).toBe('premium')
      expect(tier.name).toBe('Premium')

      process.env.STRIPE_PRICE_PREMIUM_MONTHLY = originalPremiumMonthly
    })
  })

  describe('Basic Tier Detection', () => {
    it('should return basic tier for active subscription with basic monthly price', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)

      expect(tier.id).toBe('basic')
      expect(tier.name).toBe('Basis')
      expect(tier.limits.familyDashboard).toBe(true)
      expect(tier.limits.maxDocuments).toBe(50)
    })

    it('should return basic tier for active subscription with basic yearly price', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_YEARLY)

      expect(tier.id).toBe('basic')
      expect(tier.name).toBe('Basis')
    })
  })

  describe('Family Tier Detection (treated as Premium)', () => {
    it('should return premium tier for active subscription with family monthly price', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)

      expect(tier.id).toBe('premium')
      expect(tier.name).toBe('Premium')
      expect(tier.limits.familyDashboard).toBe(true)
      expect(tier.limits.maxDocuments).toBe(-1) // unlimited
      expect(tier.limits.smsNotifications).toBe(true)
    })

    it('should return premium tier for active subscription with family yearly price', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_YEARLY)

      expect(tier.id).toBe('premium')
      expect(tier.name).toBe('Premium')
      expect(tier.limits.maxDocuments).toBe(-1) // unlimited
    })

    it('should return premium tier for trialing subscription with family price', () => {
      const tier = getTierFromSubscription('trialing', STRIPE_PRICE_FAMILY_MONTHLY)

      expect(tier.id).toBe('premium')
    })

    it('family tier should have same features as premium', () => {
      const familyTier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)
      const premiumTier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(familyTier.id).toBe(premiumTier.id)
      expect(familyTier.limits).toEqual(premiumTier.limits)
    })
  })

  describe('Free Tier Detection', () => {
    it('should return free tier when subscription_status is null', () => {
      const tier = getTierFromSubscription(null, null)

      expect(tier.id).toBe('free')
      expect(tier.name).toBe('Kostenlos')
      expect(tier.limits.familyDashboard).toBe(false)
      expect(tier.limits.maxDocuments).toBe(10)
    })

    it('should return free tier when subscription_status is canceled', () => {
      const tier = getTierFromSubscription('canceled', STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(tier.id).toBe('free')
    })

    it('should return free tier for empty string subscription status', () => {
      const tier = getTierFromSubscription('', null)

      expect(tier.id).toBe('free')
    })
  })

  describe('Edge Cases', () => {
    it('should default to basic tier when price ID is null but subscription is active', () => {
      const tier = getTierFromSubscription('active', null)

      expect(tier.id).toBe('basic')
      expect(tier.name).toBe('Basis')
    })

    it('should default to basic tier when price ID is unrecognized but subscription is active', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN)

      expect(tier.id).toBe('basic')
      expect(tier.name).toBe('Basis')
    })

    it('should default to basic tier when price ID is unrecognized but subscription is trialing', () => {
      const tier = getTierFromSubscription('trialing', STRIPE_PRICE_UNKNOWN)

      expect(tier.id).toBe('basic')
    })

    it('should return free tier when subscription status is null', () => {
      const tier = getTierFromSubscription(null, STRIPE_PRICE_PREMIUM_MONTHLY)

      expect(tier.id).toBe('free')
    })

    it('should return free tier when subscription status is canceled', () => {
      const tier = getTierFromSubscription('canceled', STRIPE_PRICE_BASIC_MONTHLY)

      expect(tier.id).toBe('free')
    })

    it('should default to basic tier when price ID is empty string but subscription is active', () => {
      const tier = getTierFromSubscription('active', '')

      expect(tier.id).toBe('basic')
    })
  })
})

describe('Silent Operation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not write console.log during successful tier detection', () => {
    getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)

    expect(console.log).not.toHaveBeenCalled()
  })

  it('does not write console.warn during fallback to basic tier', () => {
    getTierFromSubscription('active', null)

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log price IDs to console', () => {
    getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)
    getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN)

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('allowsFamilyDownloads', () => {
  it('should return true for premium tier', () => {
    expect(allowsFamilyDownloads(SUBSCRIPTION_TIERS.premium)).toBe(true)
  })

  it('should return false for basic tier', () => {
    expect(allowsFamilyDownloads(SUBSCRIPTION_TIERS.basic)).toBe(false)
  })

  it('should return false for free tier', () => {
    expect(allowsFamilyDownloads(SUBSCRIPTION_TIERS.free)).toBe(false)
  })
})

describe('getTierDisplayInfo', () => {
  it('should return correct display info for premium tier', () => {
    const info = getTierDisplayInfo(SUBSCRIPTION_TIERS.premium)

    expect(info.name).toBe('Premium')
    expect(info.color).toBe('text-purple-600')
    expect(info.viewOnly).toBe(false)
  })

  it('should return correct display info for basic tier', () => {
    const info = getTierDisplayInfo(SUBSCRIPTION_TIERS.basic)

    expect(info.name).toBe('Basis')
    expect(info.color).toBe('text-blue-600')
    expect(info.viewOnly).toBe(true)
  })

  it('should return correct display info for free tier', () => {
    const info = getTierDisplayInfo(SUBSCRIPTION_TIERS.free)

    expect(info.name).toBe('Kostenlos')
    expect(info.color).toBe('text-gray-600')
  })
})

describe('getDownloadLinkType', () => {
  it('should return download for premium tier', () => {
    expect(getDownloadLinkType(SUBSCRIPTION_TIERS.premium)).toBe('download')
  })

  it('should return view for basic tier', () => {
    expect(getDownloadLinkType(SUBSCRIPTION_TIERS.basic)).toBe('view')
  })

  it('should return null for free tier', () => {
    expect(getDownloadLinkType(SUBSCRIPTION_TIERS.free)).toBeNull()
  })
})

describe('getStripePriceIds', () => {
  it('should return all tier price IDs from environment', () => {
    const priceIds = getStripePriceIds()

    expect(priceIds.basic.monthly).toBe(STRIPE_PRICE_BASIC_MONTHLY)
    expect(priceIds.basic.yearly).toBe(STRIPE_PRICE_BASIC_YEARLY)
    expect(priceIds.premium.monthly).toBe(STRIPE_PRICE_PREMIUM_MONTHLY)
    expect(priceIds.premium.yearly).toBe(STRIPE_PRICE_PREMIUM_YEARLY)
    expect(priceIds.family.monthly).toBe(STRIPE_PRICE_FAMILY_MONTHLY)
    expect(priceIds.family.yearly).toBe(STRIPE_PRICE_FAMILY_YEARLY)
  })

  it('should handle missing environment variables gracefully', () => {
    // Store original values
    const originalFamilyMonthly = process.env.STRIPE_PRICE_FAMILY_MONTHLY
    const originalFamilyYearly = process.env.STRIPE_PRICE_FAMILY_YEARLY

    // Clear the values
    delete process.env.STRIPE_PRICE_FAMILY_MONTHLY
    delete process.env.STRIPE_PRICE_FAMILY_YEARLY

    const priceIds = getStripePriceIds()

    expect(priceIds.family.monthly).toBe('')
    expect(priceIds.family.yearly).toBe('')

    // Restore original values
    process.env.STRIPE_PRICE_FAMILY_MONTHLY = originalFamilyMonthly
    process.env.STRIPE_PRICE_FAMILY_YEARLY = originalFamilyYearly
  })
})

describe('Tier Detection Logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not log warning when price ID is null with active subscription', () => {
    const tier = getTierFromSubscription('active', null)

    expect(tier.id).toBe('basic')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should not log warning when price ID is unrecognized', () => {
    const tier = getTierFromSubscription('active', 'price_unknown_xyz')

    expect(tier.id).toBe('basic')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('should not log debug info when tier is successfully detected', () => {
    const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)

    expect(tier.id).toBe('premium')
    expect(console.log).not.toHaveBeenCalled()
  })
})
