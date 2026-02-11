import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTierFromSubscription } from '@/lib/subscription-tiers'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION,
  STRIPE_PRICE_FAMILY_MONTHLY,
  STRIPE_PRICE_UNKNOWN,
} from '../fixtures/stripe'

describe('Tier Detection Console Logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not log info for basic tier detection', () => {
    getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log info for premium tier detection', () => {
    getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log info for family tier detection', () => {
    getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log warning when price_id is missing for active subscription', () => {
    getTierFromSubscription('active', null)

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log warning when price_id is unrecognized', () => {
    getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN)

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log warning details with known price IDs for unrecognized price_id', () => {
    getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN)

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log warning when price_id is missing for trialing subscription', () => {
    getTierFromSubscription('trialing', null)

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log output for production premium price ID', () => {
    const originalPremiumMonthly = process.env.STRIPE_PRICE_PREMIUM_MONTHLY
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION

    getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY_PRODUCTION)

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()

    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = originalPremiumMonthly
  })

  it('does not log output during silent fallback to basic tier', () => {
    getTierFromSubscription('active', null)

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not log output during silent fallback to free tier', () => {
    getTierFromSubscription(null, null)

    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})
