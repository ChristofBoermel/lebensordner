import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTierFromSubscription } from '@/lib/subscription-tiers'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_FAMILY_MONTHLY,
  STRIPE_PRICE_FAMILY_YEARLY,
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

  it('logs info for basic tier detection', () => {
    getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`basic (price ID: ${STRIPE_PRICE_BASIC_MONTHLY})`)
    )
  })

  it('logs info for premium tier detection', () => {
    getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`premium (price ID: ${STRIPE_PRICE_PREMIUM_MONTHLY})`)
    )
  })

  it('logs info for family tier detection', () => {
    getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`premium via family plan (price ID: ${STRIPE_PRICE_FAMILY_MONTHLY})`)
    )
  })

  it('logs warning when price_id is missing for active subscription', () => {
    getTierFromSubscription('active', null)

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing price ID for active subscription')
    )
  })

  it('logs warning when price_id is unrecognized', () => {
    getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN)

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unrecognized price ID')
    )
  })

  it('logs warning details with known price IDs for unrecognized price_id', () => {
    getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN)

    const [[message]] = (console.warn as unknown as { mock: { calls: string[][] } }).mock.calls
    expect(message).toContain('Known price IDs: basic=[')
    expect(message).toContain(STRIPE_PRICE_BASIC_MONTHLY)
    expect(message).toContain(STRIPE_PRICE_BASIC_YEARLY)
    expect(message).toContain(STRIPE_PRICE_PREMIUM_MONTHLY)
    expect(message).toContain(STRIPE_PRICE_PREMIUM_YEARLY)
    expect(message).toContain(STRIPE_PRICE_FAMILY_MONTHLY)
    expect(message).toContain(STRIPE_PRICE_FAMILY_YEARLY)
  })

  it('logs warning when price_id is missing for trialing subscription', () => {
    getTierFromSubscription('trialing', null)

    expect(console.warn).toHaveBeenCalledWith(
      '[Tier Detection] Missing price ID for trialing subscription. Defaulting to basic tier.'
    )
  })
})
