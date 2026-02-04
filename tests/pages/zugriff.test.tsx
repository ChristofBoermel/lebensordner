import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { useState, useEffect } from 'react'
import { getTierFromSubscription, SUBSCRIPTION_TIERS, type TierConfig } from '@/lib/subscription-tiers'
import { TierStatusCard } from '@/components/ui/info-badge'
import {
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_BASIC_MONTHLY,
} from '../fixtures/stripe'
import {
  setMockProfile,
  resetMockProfile,
  setPremiumUser,
  setBasicUser,
  setFreeUser,
} from '../mocks/supabase'

// Mock the Supabase client - reads from the shared supabase-state
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      // Create a builder object that returns itself for chaining and is thenable
      const builder: Record<string, unknown> = {}

      // Make chainable methods return the same builder
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.order = vi.fn(() => builder)
      builder.update = vi.fn(() => builder)
      builder.delete = vi.fn(() => builder)
      builder.ilike = vi.fn(() => builder)
      builder.neq = vi.fn(() => builder)

      // Terminal methods that return promises
      builder.single = vi.fn(async () => {
        const { mockProfileData } = await import('../mocks/supabase-state')
        return { data: mockProfileData, error: null }
      })
      builder.insert = vi.fn().mockResolvedValue({ data: null, error: null })
      builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

      // Make the builder itself thenable (for queries without .single())
      builder.then = (
        onFulfilled?: ((value: { data: unknown[]; error: null }) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => {
        // Return empty array for list queries (trusted_persons)
        return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
      }

      return builder
    }),
  }),
}))

// Test component that simulates the Zugriff page's tier-fetching logic
// This component uses the same data flow as the actual page:
// Supabase mock -> fetch profile -> getTierFromSubscription -> TierStatusCard
function TierDisplayTestWrapper() {
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchTier() {
      // This simulates what the Zugriff page does in its useEffect
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, stripe_price_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        // This is the critical path - getTierFromSubscription determines the tier
        const tier = getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
        setUserTier(tier)
      }
      setIsLoading(false)
    }
    fetchTier()
  }, [])

  if (isLoading) {
    return <div data-testid="loading">Loading...</div>
  }

  // Render the TierStatusCard exactly as the Zugriff page does
  return <TierStatusCard tier={userTier.id} />
}

// Test the complete flow from profile data to tier detection to UI display
// These tests render a component that uses the same data flow as the Zugriff page:
// Supabase mock -> fetch profile -> getTierFromSubscription -> TierStatusCard
describe('Zugriff Page Tier Display Integration', () => {
  beforeEach(() => {
    resetMockProfile()
    vi.clearAllMocks()
  })

  describe('Premium User Display', () => {
    it('should display "Premium" when user has active premium subscription', async () => {
      // Set up mock to return premium profile - this is the shared state used by the Supabase mock
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      })

      // Render the test wrapper that uses the same tier-fetching logic as the Zugriff page
      render(<TierDisplayTestWrapper />)

      // Wait for the data to load and display tier (async useEffect fetches profile)
      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument()
      })

      // Verify the full tier description is shown (this comes from TierStatusCard)
      expect(
        screen.getByText('Ihre Vertrauenspersonen können Dokumente ansehen und herunterladen')
      ).toBeInTheDocument()
    })

    it('should display "Premium" for yearly premium subscription', async () => {
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: STRIPE_PRICE_PREMIUM_YEARLY,
      })

      render(<TierDisplayTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument()
      })
    })

    it('should display "Premium" for trialing premium subscription', async () => {
      setMockProfile({
        subscription_status: 'trialing',
        stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      })

      render(<TierDisplayTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument()
      })
    })
  })

  describe('Basic User Display', () => {
    it('should display "Basis" when user has active basic subscription', async () => {
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      })

      render(<TierDisplayTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Basis')).toBeInTheDocument()
      })
      expect(
        screen.getByText('Ihre Vertrauenspersonen können Dokumente nur ansehen (ohne Download)')
      ).toBeInTheDocument()
    })
  })

  describe('Free User Display', () => {
    it('should display "Kostenlos" when user has no subscription', async () => {
      setMockProfile({
        subscription_status: null,
        stripe_price_id: null,
      })

      render(<TierDisplayTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Kostenlos')).toBeInTheDocument()
      })
      expect(
        screen.getByText('Vertrauenspersonen-Funktion erfordert ein kostenpflichtiges Abo')
      ).toBeInTheDocument()
    })

    it('should display "Kostenlos" when subscription is canceled', async () => {
      setMockProfile({
        subscription_status: 'canceled',
        stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      })

      render(<TierDisplayTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Kostenlos')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should display "Basis" when price ID is null but subscription is active (safe default)', async () => {
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: null,
      })

      render(<TierDisplayTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Basis')).toBeInTheDocument()
      })
    })

    it('should display "Basis" when price ID is unrecognized but subscription is active', async () => {
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: 'price_unknown_12345',
      })

      render(<TierDisplayTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Basis')).toBeInTheDocument()
      })
    })
  })
})

// Test for real-world scenario: Premium subscription incorrectly showing as Basis
// This test uses the same data flow as the Zugriff page to catch regressions
describe('Premium Subscription Bug Reproduction', () => {
  beforeEach(() => {
    resetMockProfile()
    vi.clearAllMocks()
  })

  it('CRITICAL: Premium subscription should NOT display as Basis', async () => {
    // Set up mock Supabase to return a premium profile
    // This data flows through: Supabase mock -> useEffect -> getTierFromSubscription -> TierStatusCard
    setMockProfile({
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
    })

    // Render using the same tier-fetching logic as the Zugriff page
    render(<TierDisplayTestWrapper />)

    // Wait for the async data fetching to complete and verify the UI
    // If there's a bug where Premium shows as Basis, this test will fail
    await waitFor(() => {
      const premiumText = screen.queryByText('Premium')
      const basisText = screen.queryByText('Basis')

      // The page should show "Premium", NOT "Basis"
      expect(premiumText).toBeInTheDocument()
      expect(basisText).not.toBeInTheDocument()
    })
  })

  it('CRITICAL: Premium yearly subscription should NOT display as Basis', async () => {
    setMockProfile({
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_PREMIUM_YEARLY,
    })

    render(<TierDisplayTestWrapper />)

    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
      expect(screen.queryByText('Basis')).not.toBeInTheDocument()
    })
  })
})

// Test tier features
describe('Tier Feature Verification', () => {
  it('Premium tier should allow family downloads', () => {
    const tier = SUBSCRIPTION_TIERS.premium

    expect(tier.limits.familyDashboard).toBe(true)
    expect(tier.limits.maxDocuments).toBe(-1) // unlimited
  })

  it('Basic tier should have limited access', () => {
    const tier = SUBSCRIPTION_TIERS.basic

    expect(tier.limits.familyDashboard).toBe(true)
    expect(tier.limits.maxDocuments).toBe(50)
  })

  it('Free tier should have no family dashboard access', () => {
    const tier = SUBSCRIPTION_TIERS.free

    expect(tier.limits.familyDashboard).toBe(false)
    expect(tier.limits.maxDocuments).toBe(10)
  })
})
