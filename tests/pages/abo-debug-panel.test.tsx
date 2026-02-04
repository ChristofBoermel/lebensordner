import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import AboPage from '@/app/(dashboard)/abo/page'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_BASIC_YEARLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_PREMIUM_YEARLY,
  STRIPE_PRICE_FAMILY_MONTHLY,
  STRIPE_PRICE_FAMILY_YEARLY,
} from '../fixtures/stripe'
import { server, setMockProfile, resetMockProfile } from '../mocks/supabase'
import { expectDebugPanelVisible, mockDebugEnvironment, mockProductionEnvironment } from '../utils/debug-helpers'

const mockPriceIds = {
  basic: { monthly: STRIPE_PRICE_BASIC_MONTHLY, yearly: STRIPE_PRICE_BASIC_YEARLY },
  premium: { monthly: STRIPE_PRICE_PREMIUM_MONTHLY, yearly: STRIPE_PRICE_PREMIUM_YEARLY },
  family: { monthly: STRIPE_PRICE_FAMILY_MONTHLY, yearly: STRIPE_PRICE_FAMILY_YEARLY },
}

let mockSingle = vi.fn()

vi.mock('@/lib/posthog', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
  ANALYTICS_EVENTS: {
    PRICING_PAGE_VIEWED: 'pricing_page_viewed',
    CHECKOUT_STARTED: 'checkout_started',
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  }),
}))

describe('Abo Debug Panel', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/stripe/prices', () => HttpResponse.json(mockPriceIds))
    )
    mockSingle.mockImplementation(async () => {
      const { mockProfileData } = await import('../mocks/supabase-state')
      return {
        data: {
          subscription_status: mockProfileData.subscription_status,
          subscription_current_period_end: mockProfileData.updated_at,
          stripe_customer_id: mockProfileData.stripe_customer_id,
          stripe_price_id: mockProfileData.stripe_price_id,
        },
        error: null,
      }
    })
  })

  afterEach(() => {
    resetMockProfile()
    mockSingle.mockReset()
  })

  it('renders debug panel only in development mode', async () => {
    const restore = mockDebugEnvironment()
    setMockProfile({
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      stripe_customer_id: 'cus_test',
      updated_at: '2026-01-01T00:00:00.000Z',
    })

    const { unmount } = render(<AboPage />)

    await screen.findByText('Debug: Subscription Details')
    expectDebugPanelVisible()
    unmount()
    restore()

    const restoreProd = mockProductionEnvironment()
    render(<AboPage />)
    await waitFor(() => expect(mockSingle).toHaveBeenCalled())
    expect(screen.queryByText('Debug: Subscription Details')).not.toBeInTheDocument()
    restoreProd()
  })

  it.each([
    ['active'],
    ['trialing'],
    ['canceled'],
    [null],
  ])('displays subscription fields for status %s', async (status) => {
    const restore = mockDebugEnvironment()
    setMockProfile({
      subscription_status: status,
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      stripe_customer_id: 'cus_debug_123',
      updated_at: '2026-01-15T10:00:00.000Z',
    })

    render(<AboPage />)

    await screen.findByText('Debug: Subscription Details')

    expect(screen.getByText(/Status:/)).toHaveTextContent(String(status ?? 'null'))
    expect(screen.getByText(/Price ID:/)).toHaveTextContent(STRIPE_PRICE_PREMIUM_MONTHLY)
    expect(screen.getByText(/Customer ID:/)).toHaveTextContent('cus_debug_123')
    expect(screen.getByText(/Period End:/)).toHaveTextContent('2026-01-15T10:00:00.000Z')
    expect(screen.getByText(/Detected Tier:/)).toBeInTheDocument()
    expect(screen.getByText(/Tier Name:/)).toBeInTheDocument()
    restore()
  })

  it('shows known price IDs for all tiers', async () => {
    const restore = mockDebugEnvironment()
    setMockProfile({
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      stripe_customer_id: 'cus_known_prices',
      updated_at: '2026-01-10T00:00:00.000Z',
    })

    render(<AboPage />)

    await screen.findByText('Known Price IDs:')
    expect(screen.getByText(`Basic Monthly: ${STRIPE_PRICE_BASIC_MONTHLY}`)).toBeInTheDocument()
    expect(screen.getByText(`Basic Yearly: ${STRIPE_PRICE_BASIC_YEARLY}`)).toBeInTheDocument()
    expect(screen.getByText(`Premium Monthly: ${STRIPE_PRICE_PREMIUM_MONTHLY}`)).toBeInTheDocument()
    expect(screen.getByText(`Premium Yearly: ${STRIPE_PRICE_PREMIUM_YEARLY}`)).toBeInTheDocument()
    expect(screen.getByText(`Family Monthly: ${STRIPE_PRICE_FAMILY_MONTHLY}`)).toBeInTheDocument()
    expect(screen.getByText(`Family Yearly: ${STRIPE_PRICE_FAMILY_YEARLY}`)).toBeInTheDocument()
    restore()
  })

  it('refresh button triggers fetchSubscription', async () => {
    const restore = mockDebugEnvironment()
    setMockProfile({
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      stripe_customer_id: 'cus_refresh',
      updated_at: '2026-01-05T00:00:00.000Z',
    })

    render(<AboPage />)

    const refreshBtn = await screen.findByRole('button', { name: /Refresh Subscription Data/i })
    const initialCalls = mockSingle.mock.calls.length

    await userEvent.click(refreshBtn)

    await waitFor(() => {
      expect(mockSingle.mock.calls.length).toBeGreaterThan(initialCalls)
    })
    restore()
  })
})
