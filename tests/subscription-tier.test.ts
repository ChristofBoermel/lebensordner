import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  SUBSCRIPTION_TIERS,
  allowsFamilyDownloads,
  canPerformAction,
  getDownloadLinkType,
  getStripePriceIds,
  getTierDisplayInfo,
  getTierFromSubscription,
} from '@/lib/subscription-tiers'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION,
  STRIPE_PRICE_UNKNOWN,
} from './fixtures/stripe'

describe('subscription tiers', () => {
  it('applies revised tier limits', () => {
    expect(SUBSCRIPTION_TIERS.free.limits.maxDocuments).toBe(20)
    expect(SUBSCRIPTION_TIERS.basic.limits.twoFactorAuth).toBe(true)
    expect(SUBSCRIPTION_TIERS.premium.name).toBe('Vorsorge')
    expect(SUBSCRIPTION_TIERS.premium.limits.emergencyAccess).toBe(true)
    expect(SUBSCRIPTION_TIERS.basic.limits.emergencyAccess).toBe(false)
    expect(SUBSCRIPTION_TIERS.free.limits.emergencyAccess).toBe(false)
  })

  it('supports emergency access action guard', () => {
    expect(canPerformAction(SUBSCRIPTION_TIERS.free, 'useEmergencyAccess')).toBe(false)
    expect(canPerformAction(SUBSCRIPTION_TIERS.basic, 'useEmergencyAccess')).toBe(false)
    expect(canPerformAction(SUBSCRIPTION_TIERS.premium, 'useEmergencyAccess')).toBe(true)
  })
})

describe('getTierFromSubscription', () => {
  const originalPremiumMonthly = process.env.STRIPE_PRICE_PREMIUM_MONTHLY
  const originalPremiumYearly = process.env.STRIPE_PRICE_PREMIUM_YEARLY
  const originalPremiumLegacyMonthly = process.env.STRIPE_PRICE_PREMIUM_LEGACY_MONTHLY

  beforeEach(() => {
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = STRIPE_PRICE_PREMIUM_MONTHLY
    process.env.STRIPE_PRICE_PREMIUM_YEARLY = STRIPE_PRICE_PREMIUM_YEARLY
    process.env.STRIPE_PRICE_PREMIUM_LEGACY_MONTHLY = ''
  })

  afterEach(() => {
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = originalPremiumMonthly
    process.env.STRIPE_PRICE_PREMIUM_YEARLY = originalPremiumYearly
    process.env.STRIPE_PRICE_PREMIUM_LEGACY_MONTHLY = originalPremiumLegacyMonthly
  })

  it('detects basic and premium price IDs', () => {
    expect(getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY).id).toBe('basic')
    expect(getTierFromSubscription('active', STRIPE_PRICE_BASIC_YEARLY).id).toBe('basic')
    expect(getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY).id).toBe('premium')
    expect(getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_YEARLY).id).toBe('premium')
  })

  it('returns premium for known legacy premium production ID', () => {
    const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION)
    expect(tier.id).toBe('premium')
  })

  it('returns premium for configured legacy premium env IDs', () => {
    process.env.STRIPE_PRICE_PREMIUM_LEGACY_MONTHLY = 'price_legacy_vorsorge_monthly'
    const tier = getTierFromSubscription('active', 'price_legacy_vorsorge_monthly')
    expect(tier.id).toBe('premium')
  })

  it('falls back safely for unknown or missing active prices', () => {
    expect(getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN).id).toBe('basic')
    expect(getTierFromSubscription('active', null).id).toBe('basic')
    expect(getTierFromSubscription('active', '').id).toBe('basic')
  })

  it('returns free for canceled or missing status', () => {
    expect(getTierFromSubscription('canceled', STRIPE_PRICE_PREMIUM_MONTHLY).id).toBe('free')
    expect(getTierFromSubscription(null, STRIPE_PRICE_PREMIUM_MONTHLY).id).toBe('free')
    expect(getTierFromSubscription('', STRIPE_PRICE_PREMIUM_MONTHLY).id).toBe('free')
  })
})

describe('stripe price IDs and display', () => {
  it('does not expose family price IDs anymore', () => {
    const priceIds = getStripePriceIds() as Record<string, unknown>
    expect(priceIds.basic).toBeTruthy()
    expect(priceIds.premium).toBeTruthy()
    expect(priceIds.family).toBeUndefined()
  })

  it('uses Vorsorge display naming for premium tier', () => {
    const display = getTierDisplayInfo(SUBSCRIPTION_TIERS.premium)
    expect(display.name).toBe('Vorsorge')
  })

  it('allows family downloads for basic and premium tiers', () => {
    expect(allowsFamilyDownloads(SUBSCRIPTION_TIERS.free)).toBe(false)
    expect(allowsFamilyDownloads(SUBSCRIPTION_TIERS.basic)).toBe(true)
    expect(allowsFamilyDownloads(SUBSCRIPTION_TIERS.premium)).toBe(true)
  })

  it('creates download links for basic and premium tiers', () => {
    expect(getDownloadLinkType(SUBSCRIPTION_TIERS.free)).toBeNull()
    expect(getDownloadLinkType(SUBSCRIPTION_TIERS.basic)).toBe('download')
    expect(getDownloadLinkType(SUBSCRIPTION_TIERS.premium)).toBe('download')
  })

  it('basic tier is no longer view-only', () => {
    expect(getTierDisplayInfo(SUBSCRIPTION_TIERS.basic).viewOnly).toBe(false)
    expect(getTierDisplayInfo(SUBSCRIPTION_TIERS.premium).viewOnly).toBe(false)
  })
})
