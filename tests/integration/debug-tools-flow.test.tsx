import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import AboPage from '@/app/(dashboard)/abo/page'
import AdminPage from '@/app/(dashboard)/admin/page'
import {
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_UNKNOWN,
} from '../fixtures/stripe'
import { server } from '../mocks/supabase'
import { mockDebugEnvironment, createMockPlatformStats } from '../utils/debug-helpers'

let mockRole = 'admin'
let mockStats = createMockPlatformStats()
let mockUsers: any[] = []
let mockProfile = {
  subscription_status: 'active' as string | null,
  stripe_price_id: STRIPE_PRICE_UNKNOWN,
  stripe_customer_id: 'cus_debug_flow',
  updated_at: '2026-01-20T00:00:00.000Z',
}

const mockRpc = vi.fn(async (fnName: string) => {
  if (fnName === 'get_platform_stats') {
    return { data: mockStats, error: null }
  }
  if (fnName === 'get_all_users') {
    return { data: mockUsers, error: null }
  }
  return { data: null, error: null }
})

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
        data: { user: { id: 'admin-user-id', email: 'admin@example.com' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              role: mockRole,
              subscription_status: mockProfile.subscription_status,
              subscription_current_period_end: mockProfile.updated_at,
              stripe_customer_id: mockProfile.stripe_customer_id,
              stripe_price_id: mockProfile.stripe_price_id,
            },
            error: null,
          }),
        })),
      })),
    })),
    rpc: mockRpc,
  }),
}))

describe('Debug Tools Integration Flow', () => {
  beforeEach(() => {
    mockRole = 'admin'
    mockStats = createMockPlatformStats()
    mockUsers = [
      {
        id: 'user-1',
        email: 'search@example.com',
        full_name: 'Search User',
        role: 'user',
        created_at: '2024-01-15T10:00:00Z',
        onboarding_completed: true,
        subscription_status: 'active',
        storage_used: 1024 * 1024 * 10,
      },
    ]
    mockProfile = {
      subscription_status: 'active',
      stripe_price_id: STRIPE_PRICE_UNKNOWN,
      stripe_customer_id: 'cus_debug_flow',
      updated_at: '2026-01-20T00:00:00.000Z',
    }
    mockRpc.mockClear()
    server.use(
      http.get('/api/stripe/prices', () => HttpResponse.json({
        basic: { monthly: 'price_basic_monthly_test', yearly: 'price_basic_yearly_test' },
        premium: { monthly: STRIPE_PRICE_PREMIUM_MONTHLY, yearly: 'price_premium_yearly_test' },
        family: { monthly: 'price_family_monthly_test', yearly: 'price_family_yearly_test' },
      }))
    )
  })

  it('walks through abo and admin debug tools flow', async () => {
    const user = userEvent.setup()
    const restore = mockDebugEnvironment()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      render(<AboPage />)

      await screen.findByText('Debug: Subscription Details')
      expect(screen.getByText(/Status:/)).toHaveTextContent('active')
      expect(screen.getByText(/Price ID:/)).toHaveTextContent(STRIPE_PRICE_UNKNOWN)

      const refreshBtn = await screen.findByRole('button', { name: /Refresh Subscription Data/i })
      await user.click(refreshBtn)

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Unrecognized price ID')
        )
      })

      cleanup()

      render(<AdminPage />)

      await screen.findByText('Admin Dashboard')
      expect(screen.getByText('150')).toBeInTheDocument()

      const searchInput = screen.getByPlaceholderText(/Nach E-Mail oder Name suchen/i)
      await user.type(searchInput, 'search@example.com')

      expect(screen.getByText('Search User')).toBeInTheDocument()
      expect(screen.getByText('Premium')).toBeInTheDocument()
    } finally {
      warnSpy.mockRestore()
      restore()
    }
  })
})
