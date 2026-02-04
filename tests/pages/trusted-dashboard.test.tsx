import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useState, useEffect } from 'react'
import { http, HttpResponse } from 'msw'
import {
  getTierFromSubscription,
  SUBSCRIPTION_TIERS,
  hasFeatureAccess,
  type TierConfig,
} from '@/lib/subscription-tiers'
import {
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_FAMILY_MONTHLY,
  STRIPE_PRICE_FAMILY_YEARLY,
  STRIPE_PRICE_UNKNOWN,
} from '../fixtures/stripe'
import {
  setMockProfile,
  resetMockProfile,
  setPremiumUser,
  setBasicUser,
  setFreeUser,
  setFamilyMonthlyUser,
  setFamilyYearlyUser,
  setCanceledUser,
  setTrialingUser,
  server,
} from '../mocks/supabase'
import { DashboardNav } from '@/components/layout/dashboard-nav'
import FamilienUebersichtClientPage from '@/app/(dashboard)/vp-dashboard/client'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/vp-dashboard',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock the Supabase client - reads from the shared supabase-state
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {}

      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.order = vi.fn(() => builder)
      builder.update = vi.fn(() => builder)
      builder.delete = vi.fn(() => builder)
      builder.ilike = vi.fn(() => builder)
      builder.neq = vi.fn(() => builder)

      builder.single = vi.fn(async () => {
        const { mockProfileData } = await import('../mocks/supabase-state')
        return { data: mockProfileData, error: null }
      })
      builder.insert = vi.fn().mockResolvedValue({ data: null, error: null })
      builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

      builder.then = (
        onFulfilled?: ((value: { data: unknown[]; error: null }) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => {
        return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
      }

      return builder
    }),
  }),
}))

// Mock ThemeProvider for DashboardNav
vi.mock('@/components/theme/theme-provider', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
    fontSize: 'normal',
    setFontSize: vi.fn(),
    seniorMode: false,
    setSeniorMode: vi.fn(),
  }),
}))

// Mock GlobalSearch component
vi.mock('@/components/search/global-search', () => ({
  GlobalSearch: () => null,
}))

// Default test user props for DashboardNav
const defaultTestUser = {
  email: 'test@example.com',
  full_name: 'Test User',
  role: null,
  profile_picture_url: null,
}

// Test component that wraps DashboardNav with tier-fetching logic from Supabase mock
// This tests the full integration: Supabase mock -> fetch profile -> getTierFromSubscription -> DashboardNav
function FullIntegrationTestWrapper() {
  const [tier, setTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchTier() {
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
        const detectedTier = getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
        setTier(detectedTier)
      }
      setIsLoading(false)
    }
    fetchTier()
  }, [])

  if (isLoading) {
    return <div data-testid="loading">Loading...</div>
  }

  return (
    <div>
      <div data-testid="tier-display">Current Tier: {tier.name}</div>
      <DashboardNav user={defaultTestUser} tier={tier} />
    </div>
  )
}

// ============================================================================
// Test Suite: Core Logic Unit Tests (getTierFromSubscription + hasFeatureAccess)
// These replace PageAccessTestWrapper - testing the actual functions instead of wrappers
// ============================================================================
describe('Page Access Control Logic - Unit Tests', () => {
  describe('getTierFromSubscription function', () => {
    it('should return premium tier for active premium monthly subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(tier.id).toBe('premium')
      expect(tier.name).toBe('Premium')
    })

    it('should return premium tier for active premium yearly subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_YEARLY)
      expect(tier.id).toBe('premium')
    })

    it('should return basic tier for active basic monthly subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)
      expect(tier.id).toBe('basic')
      expect(tier.name).toBe('Basis')
    })

    it('should return basic tier for active basic yearly subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_YEARLY)
      expect(tier.id).toBe('basic')
    })

    it('should return premium tier for family monthly subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)
      expect(tier.id).toBe('premium')
    })

    it('should return premium tier for family yearly subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_YEARLY)
      expect(tier.id).toBe('premium')
    })

    it('should return free tier for null subscription status', () => {
      const tier = getTierFromSubscription(null, null)
      expect(tier.id).toBe('free')
      expect(tier.name).toBe('Kostenlos')
    })

    it('should return free tier for canceled subscription', () => {
      const tier = getTierFromSubscription('canceled', STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(tier.id).toBe('free')
    })

    it('should return correct tier for trialing premium subscription', () => {
      const tier = getTierFromSubscription('trialing', STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(tier.id).toBe('premium')
    })

    it('should return basic tier for unknown price ID with active subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_UNKNOWN)
      expect(tier.id).toBe('basic')
    })

    it('should return basic tier for null price ID with active subscription', () => {
      const tier = getTierFromSubscription('active', null)
      expect(tier.id).toBe('basic')
    })
  })

  describe('hasFeatureAccess function - familyDashboard', () => {
    it('should return true for premium tier', () => {
      expect(hasFeatureAccess(SUBSCRIPTION_TIERS.premium, 'familyDashboard')).toBe(true)
    })

    it('should return true for basic tier', () => {
      expect(hasFeatureAccess(SUBSCRIPTION_TIERS.basic, 'familyDashboard')).toBe(true)
    })

    it('should return false for free tier', () => {
      expect(hasFeatureAccess(SUBSCRIPTION_TIERS.free, 'familyDashboard')).toBe(false)
    })

    it('should return true for premium tier from active premium subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(hasFeatureAccess(tier, 'familyDashboard')).toBe(true)
    })

    it('should return true for basic tier from active basic subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)
      expect(hasFeatureAccess(tier, 'familyDashboard')).toBe(true)
    })

    it('should return false for free tier from canceled subscription', () => {
      const tier = getTierFromSubscription('canceled', STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(hasFeatureAccess(tier, 'familyDashboard')).toBe(false)
    })

    it('should return true for family monthly subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)
      expect(hasFeatureAccess(tier, 'familyDashboard')).toBe(true)
    })

    it('should return true for trialing premium subscription', () => {
      const tier = getTierFromSubscription('trialing', STRIPE_PRICE_PREMIUM_MONTHLY)
      expect(hasFeatureAccess(tier, 'familyDashboard')).toBe(true)
    })
  })

  describe('Server page access control simulation', () => {
    // These tests verify the same logic flow as vp-dashboard/page.tsx:
    // getTierFromSubscription() -> hasFeatureAccess(tier, 'familyDashboard') -> redirect if false

    it('should allow access for premium user (simulates page.tsx logic)', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_MONTHLY)
      const hasAccess = hasFeatureAccess(tier, 'familyDashboard')
      expect(hasAccess).toBe(true)
    })

    it('should allow access for basic user (simulates page.tsx logic)', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_MONTHLY)
      const hasAccess = hasFeatureAccess(tier, 'familyDashboard')
      expect(hasAccess).toBe(true)
    })

    it('should deny access for free user (simulates page.tsx redirect)', () => {
      const tier = getTierFromSubscription(null, null)
      const hasAccess = hasFeatureAccess(tier, 'familyDashboard')
      expect(hasAccess).toBe(false)
      // In the actual page.tsx, this would trigger: redirect('/abo?upgrade=familyDashboard')
    })

    it('should deny access for canceled subscription (simulates page.tsx redirect)', () => {
      const tier = getTierFromSubscription('canceled', STRIPE_PRICE_PREMIUM_MONTHLY)
      const hasAccess = hasFeatureAccess(tier, 'familyDashboard')
      expect(hasAccess).toBe(false)
    })
  })
})

// ============================================================================
// Test Suite: Navigation Visibility Tests (using real DashboardNav component)
// ============================================================================
describe('Trusted Dashboard Navigation Visibility', () => {
  beforeEach(() => {
    resetMockProfile()
    vi.clearAllMocks()
  })

  describe('Premium User', () => {
    it('should show Familien-Übersicht link for premium user', () => {
      const tier = SUBSCRIPTION_TIERS.premium

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      const link = screen.queryByText('Familien-Übersicht')
      expect(link).toBeInTheDocument()
      expect(link?.closest('a')).toHaveAttribute('href', '/vp-dashboard')
    })

    it('should show Familien-Übersicht link for yearly premium subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_PREMIUM_YEARLY)

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      expect(screen.queryByText('Familien-Übersicht')).toBeInTheDocument()
    })
  })

  describe('Basic User', () => {
    it('should show Familien-Übersicht link for basic user', () => {
      const tier = SUBSCRIPTION_TIERS.basic

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      const link = screen.queryByText('Familien-Übersicht')
      expect(link).toBeInTheDocument()
      expect(link?.closest('a')).toHaveAttribute('href', '/vp-dashboard')
    })

    it('should show Familien-Übersicht link for yearly basic subscription', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_BASIC_YEARLY)

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      expect(screen.queryByText('Familien-Übersicht')).toBeInTheDocument()
    })
  })

  describe('Free User', () => {
    it('should hide Familien-Übersicht link for free user', () => {
      const tier = SUBSCRIPTION_TIERS.free

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      expect(screen.queryByText('Familien-Übersicht')).not.toBeInTheDocument()
    })

    it('should still show other navigation items for free user', () => {
      const tier = SUBSCRIPTION_TIERS.free

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      expect(screen.queryByText('Übersicht')).toBeInTheDocument()
      expect(screen.queryByText('Dokumente')).toBeInTheDocument()
      expect(screen.queryByText('Zugriff & Familie')).toBeInTheDocument()
    })
  })

  describe('Family Tier Users', () => {
    it('should show Familien-Übersicht link for family monthly user (treated as premium)', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_MONTHLY)

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      expect(screen.queryByText('Familien-Übersicht')).toBeInTheDocument()
    })

    it('should show Familien-Übersicht link for family yearly user (treated as premium)', () => {
      const tier = getTierFromSubscription('active', STRIPE_PRICE_FAMILY_YEARLY)

      render(<DashboardNav user={defaultTestUser} tier={tier} />)

      expect(screen.queryByText('Familien-Übersicht')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// Test Suite: Client Component Tests (FamilienUebersichtClientPage)
// Tests the real client component with MSW mocks
// ============================================================================
describe('FamilienUebersichtClientPage - Client Component Tests', () => {
  beforeEach(() => {
    resetMockProfile()
    vi.clearAllMocks()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('Empty State', () => {
    it('should show empty state when no family members exist', async () => {
      // Mock API to return empty members
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({ members: [] })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Keine Familien-Verbindungen')).toBeInTheDocument()
      })

      // Verify the empty state description
      expect(screen.getByText(/Sie haben noch keine Familien-Verbindungen/)).toBeInTheDocument()
    })
  })

  describe('Help Text Display', () => {
    it('should show help text when user only has outgoing members', async () => {
      // Mock API to return only outgoing members (user added them, but they haven't added user)
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({
            members: [
              {
                id: 'member-1',
                name: 'Maria Beispiel',
                email: 'maria@example.com',
                relationship: 'Mutter',
                direction: 'outgoing',
                linkedAt: '2024-01-15T10:00:00Z',
              },
            ],
          })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('So funktioniert die Familien-Übersicht')).toBeInTheDocument()
      })

      // Verify the help text explanation
      expect(
        screen.getByText(/Um Dokumente von Familienmitgliedern herunterzuladen/)
      ).toBeInTheDocument()
    })
  })

  describe('Access Banners', () => {
    it('should show download access banner for premium incoming member', async () => {
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({
            members: [
              {
                id: 'member-1',
                name: 'Hans Premium',
                email: 'hans@example.com',
                relationship: 'Vater',
                direction: 'incoming',
                linkedAt: '2024-01-15T10:00:00Z',
                tier: {
                  id: 'premium',
                  name: 'Premium',
                  color: 'text-purple-600',
                  badge: 'bg-purple-100',
                  canDownload: true,
                  viewOnly: false,
                },
              },
            ],
          })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Vollständiger Download-Zugriff verfügbar')).toBeInTheDocument()
      })

      // Verify download button is available
      expect(screen.getByText('Dokumente laden')).toBeInTheDocument()
    })

    it('should show view-only banner for basic incoming member', async () => {
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({
            members: [
              {
                id: 'member-1',
                name: 'Anna Basis',
                email: 'anna@example.com',
                relationship: 'Schwester',
                direction: 'incoming',
                linkedAt: '2024-01-15T10:00:00Z',
                tier: {
                  id: 'basic',
                  name: 'Basis',
                  color: 'text-blue-600',
                  badge: 'bg-blue-100',
                  canDownload: false,
                  viewOnly: true,
                },
              },
            ],
          })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Nur-Ansicht-Zugriff verfügbar')).toBeInTheDocument()
      })

      // Verify view-only button is available
      expect(screen.getByText('Nur Ansicht')).toBeInTheDocument()
    })

    it('should show no access banner for free incoming member', async () => {
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({
            members: [
              {
                id: 'member-1',
                name: 'Lisa Kostenlos',
                email: 'lisa@example.com',
                relationship: 'Cousine',
                direction: 'incoming',
                linkedAt: '2024-01-15T10:00:00Z',
                tier: {
                  id: 'free',
                  name: 'Kostenlos',
                  color: 'text-warmgray-600',
                  badge: 'bg-warmgray-100',
                  canDownload: false,
                  viewOnly: false,
                },
              },
            ],
          })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Kein Zugriff verfügbar')).toBeInTheDocument()
      })

      // Verify disabled button is shown
      expect(screen.getByText('Abo erforderlich')).toBeInTheDocument()
    })
  })

  describe('Member Display', () => {
    it('should display incoming member with correct information', async () => {
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({
            members: [
              {
                id: 'member-1',
                name: 'Max Mustermann',
                email: 'max@example.com',
                relationship: 'Bruder',
                direction: 'incoming',
                linkedAt: '2024-06-15T10:00:00Z',
                tier: {
                  id: 'premium',
                  name: 'Premium',
                  color: 'text-purple-600',
                  badge: 'bg-purple-100',
                  canDownload: true,
                  viewOnly: false,
                },
              },
            ],
          })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
      })

      expect(screen.getByText('Bruder')).toBeInTheDocument()
      expect(screen.getByText('max@example.com')).toBeInTheDocument()
      expect(screen.getByText('Zugriff auf Dokumente')).toBeInTheDocument()
    })

    it('should display outgoing member with correct information', async () => {
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({
            members: [
              {
                id: 'member-1',
                name: 'Erika Beispiel',
                email: 'erika@example.com',
                relationship: 'Tochter',
                direction: 'outgoing',
                linkedAt: '2024-03-20T10:00:00Z',
              },
            ],
          })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Erika Beispiel')).toBeInTheDocument()
      })

      expect(screen.getByText('Tochter')).toBeInTheDocument()
      expect(screen.getByText('Ihre Vertrauenspersonen')).toBeInTheDocument()
      expect(screen.getByText('Hat Zugriff auf Ihre Dokumente')).toBeInTheDocument()
    })

    it('should display mixed incoming and outgoing members', async () => {
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({
            members: [
              {
                id: 'member-1',
                name: 'Incoming Member',
                email: 'incoming@example.com',
                relationship: 'Vater',
                direction: 'incoming',
                linkedAt: '2024-01-01T10:00:00Z',
                tier: {
                  id: 'premium',
                  name: 'Premium',
                  color: 'text-purple-600',
                  badge: 'bg-purple-100',
                  canDownload: true,
                  viewOnly: false,
                },
              },
              {
                id: 'member-2',
                name: 'Outgoing Member',
                email: 'outgoing@example.com',
                relationship: 'Sohn',
                direction: 'outgoing',
                linkedAt: '2024-02-01T10:00:00Z',
              },
            ],
          })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Incoming Member')).toBeInTheDocument()
        expect(screen.getByText('Outgoing Member')).toBeInTheDocument()
      })

      // Both sections should be visible
      expect(screen.getByText('Zugriff auf Dokumente')).toBeInTheDocument()
      expect(screen.getByText('Ihre Vertrauenspersonen')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      server.use(
        http.post('/api/trusted-person/link', () => {
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        })
      )

      render(<FamilienUebersichtClientPage />)

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner initially', async () => {
      server.use(
        http.post('/api/trusted-person/link', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json({ success: true })
        }),
        http.get('/api/family/members', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json({ members: [] })
        })
      )

      render(<FamilienUebersichtClientPage />)

      // Loading spinner should be visible initially
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// Test Suite: Integration Flow Tests
// ============================================================================
describe('Trusted Dashboard Full Integration Flow', () => {
  beforeEach(() => {
    resetMockProfile()
    vi.clearAllMocks()
  })

  describe('Premium Profile → Navigation Shows Tab', () => {
    it('should show Familien-Übersicht when profile has premium subscription', async () => {
      // Mock profile → getTierFromSubscription → DashboardNav → feature check
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      })

      render(<FullIntegrationTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
        expect(screen.getByTestId('tier-display')).toHaveTextContent('Premium')
      })
    })
  })

  describe('Basic Profile → Navigation Shows Tab', () => {
    it('should show Familien-Übersicht when profile has basic subscription', async () => {
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      })

      render(<FullIntegrationTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
        expect(screen.getByTestId('tier-display')).toHaveTextContent('Basis')
      })
    })
  })

  describe('Free Profile → Navigation Hides Tab', () => {
    it('should hide Familien-Übersicht when profile has no subscription', async () => {
      setMockProfile({
        subscription_status: null,
        stripe_price_id: null,
      })

      render(<FullIntegrationTestWrapper />)

      await waitFor(() => {
        expect(screen.queryByText('Familien-Übersicht')).not.toBeInTheDocument()
        expect(screen.getByTestId('tier-display')).toHaveTextContent('Kostenlos')
      })
    })
  })

  describe('Unrecognized Price → Defaults to Basic → Shows Tab', () => {
    it('should default to basic tier and show tab for unknown price ID with active subscription', async () => {
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: STRIPE_PRICE_UNKNOWN,
      })

      render(<FullIntegrationTestWrapper />)

      await waitFor(() => {
        // Unknown price defaults to basic, which has familyDashboard: true
        expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
        expect(screen.getByTestId('tier-display')).toHaveTextContent('Basis')
      })
    })

    it('should default to basic tier and show tab when price ID is null but subscription is active', async () => {
      setMockProfile({
        subscription_status: 'active',
        stripe_price_id: null,
      })

      render(<FullIntegrationTestWrapper />)

      await waitFor(() => {
        expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
        expect(screen.getByTestId('tier-display')).toHaveTextContent('Basis')
      })
    })
  })
})

// ============================================================================
// Test Suite: Navigation Item Configuration (validated via real DashboardNav)
// ============================================================================
describe('Navigation Item Configuration', () => {
  it('should render Familien-Übersicht with correct href in real DashboardNav', () => {
    render(<DashboardNav user={defaultTestUser} tier={SUBSCRIPTION_TIERS.premium} />)

    const familyLink = screen.getByText('Familien-Übersicht')
    expect(familyLink).toBeInTheDocument()
    expect(familyLink.closest('a')).toHaveAttribute('href', '/vp-dashboard')
  })

  it('should feature-gate Familien-Übersicht based on familyDashboard access in real DashboardNav', () => {
    // With free tier (no familyDashboard access), the link should not appear
    const { rerender } = render(<DashboardNav user={defaultTestUser} tier={SUBSCRIPTION_TIERS.free} />)
    expect(screen.queryByText('Familien-Übersicht')).not.toBeInTheDocument()

    // With premium tier (has familyDashboard access), the link should appear
    rerender(<DashboardNav user={defaultTestUser} tier={SUBSCRIPTION_TIERS.premium} />)
    expect(screen.queryByText('Familien-Übersicht')).toBeInTheDocument()
  })
})

// ============================================================================
// Test Suite: Tier Feature Verification (familyDashboard specific)
// ============================================================================
describe('Tier Feature Verification - familyDashboard', () => {
  it('Premium tier should have familyDashboard enabled', () => {
    const tier = SUBSCRIPTION_TIERS.premium
    expect(tier.limits.familyDashboard).toBe(true)
  })

  it('Basic tier should have familyDashboard enabled', () => {
    const tier = SUBSCRIPTION_TIERS.basic
    expect(tier.limits.familyDashboard).toBe(true)
  })

  it('Free tier should have familyDashboard disabled', () => {
    const tier = SUBSCRIPTION_TIERS.free
    expect(tier.limits.familyDashboard).toBe(false)
  })
})

// ============================================================================
// Test Suite: CRITICAL Bug Reproduction Tests
// ============================================================================
describe('CRITICAL: Premium/Basic Subscription Bug Reproduction', () => {
  beforeEach(() => {
    resetMockProfile()
    vi.clearAllMocks()
  })

  it('CRITICAL: Premium user should see Familien-Übersicht in navigation', async () => {
    // Set up mock Supabase to return a premium profile
    // Data flows: Supabase mock → useEffect → getTierFromSubscription → hasFeatureAccess → render
    setMockProfile({
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
    })

    render(<FullIntegrationTestWrapper />)

    await waitFor(() => {
      const familyLink = screen.queryByText('Familien-Übersicht')

      // Premium user should see the navigation item
      expect(familyLink).toBeInTheDocument()
    })
  })

  it('CRITICAL: Basic user should see Familien-Übersicht in navigation', async () => {
    setMockProfile({
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
    })

    render(<FullIntegrationTestWrapper />)

    await waitFor(() => {
      const familyLink = screen.queryByText('Familien-Übersicht')

      // Basic user should also see the navigation item
      expect(familyLink).toBeInTheDocument()
    })
  })

  it('CRITICAL: Free user should NOT see Familien-Übersicht in navigation', async () => {
    setMockProfile({
      subscription_status: null,
      stripe_price_id: null,
    })

    render(<FullIntegrationTestWrapper />)

    await waitFor(() => {
      const familyLink = screen.queryByText('Familien-Übersicht')

      // Free user should NOT see the navigation item
      expect(familyLink).not.toBeInTheDocument()
    })
  })

  it('CRITICAL: Canceled premium user should NOT see Familien-Übersicht in navigation', async () => {
    setMockProfile({
      subscription_status: 'canceled',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
    })

    render(<FullIntegrationTestWrapper />)

    await waitFor(() => {
      const familyLink = screen.queryByText('Familien-Übersicht')

      // Canceled subscription = free tier = no access
      expect(familyLink).not.toBeInTheDocument()
    })
  })
})

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================
describe('Edge Cases', () => {
  beforeEach(() => {
    resetMockProfile()
    vi.clearAllMocks()
  })

  it('should handle trialing subscription with premium price correctly', async () => {
    setMockProfile({
      subscription_status: 'trialing',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
    })

    render(<FullIntegrationTestWrapper />)

    await waitFor(() => {
      expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
      expect(screen.getByTestId('tier-display')).toHaveTextContent('Premium')
    })
  })

  it('should handle trialing subscription with basic price correctly', async () => {
    setMockProfile({
      subscription_status: 'trialing',
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
    })

    render(<FullIntegrationTestWrapper />)

    await waitFor(() => {
      expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
      expect(screen.getByTestId('tier-display')).toHaveTextContent('Basis')
    })
  })

  it('should handle past_due subscription as still active (safe default)', async () => {
    // past_due is not 'canceled', so should still grant access
    setMockProfile({
      subscription_status: 'past_due',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
    })

    const tier = getTierFromSubscription('past_due', STRIPE_PRICE_PREMIUM_MONTHLY)
    render(<DashboardNav user={defaultTestUser} tier={tier} />)

    // past_due should still show premium features
    expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
  })

  it('should handle unpaid subscription correctly', async () => {
    setMockProfile({
      subscription_status: 'unpaid',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
    })

    const tier = getTierFromSubscription('unpaid', STRIPE_PRICE_PREMIUM_MONTHLY)
    render(<DashboardNav user={defaultTestUser} tier={tier} />)

    // unpaid should still show features (not canceled)
    expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
  })

  describe('All Subscription Statuses', () => {
    const subscriptionStatuses = ['active', 'trialing', 'past_due', 'unpaid']

    subscriptionStatuses.forEach((status) => {
      it(`should show Familien-Übersicht for ${status} premium subscription`, () => {
        const tier = getTierFromSubscription(status, STRIPE_PRICE_PREMIUM_MONTHLY)
        render(<DashboardNav user={defaultTestUser} tier={tier} />)
        expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
      })
    })

    it('should hide Familien-Übersicht for canceled subscription', () => {
      const tier = getTierFromSubscription('canceled', STRIPE_PRICE_PREMIUM_MONTHLY)
      render(<DashboardNav user={defaultTestUser} tier={tier} />)
      expect(screen.queryByText('Familien-Übersicht')).not.toBeInTheDocument()
    })

    it('should hide Familien-Übersicht for null subscription status', () => {
      const tier = getTierFromSubscription(null, null)
      render(<DashboardNav user={defaultTestUser} tier={tier} />)
      expect(screen.queryByText('Familien-Übersicht')).not.toBeInTheDocument()
    })
  })

  describe('All Price ID Variations', () => {
    const premiumPriceIds = [
      { name: 'premium monthly', priceId: STRIPE_PRICE_PREMIUM_MONTHLY },
      { name: 'premium yearly', priceId: STRIPE_PRICE_PREMIUM_YEARLY },
      { name: 'family monthly', priceId: STRIPE_PRICE_FAMILY_MONTHLY },
      { name: 'family yearly', priceId: STRIPE_PRICE_FAMILY_YEARLY },
    ]

    premiumPriceIds.forEach(({ name, priceId }) => {
      it(`should show Familien-Übersicht for ${name} price ID`, () => {
        const tier = getTierFromSubscription('active', priceId)
        render(<DashboardNav user={defaultTestUser} tier={tier} />)
        expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
      })
    })

    const basicPriceIds = [
      { name: 'basic monthly', priceId: STRIPE_PRICE_BASIC_MONTHLY },
      { name: 'basic yearly', priceId: STRIPE_PRICE_BASIC_YEARLY },
    ]

    basicPriceIds.forEach(({ name, priceId }) => {
      it(`should show Familien-Übersicht for ${name} price ID`, () => {
        const tier = getTierFromSubscription('active', priceId)
        render(<DashboardNav user={defaultTestUser} tier={tier} />)
        expect(screen.getByText('Familien-Übersicht')).toBeInTheDocument()
      })
    })
  })
})
