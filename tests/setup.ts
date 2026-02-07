import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import { server } from './mocks/supabase'

// Set up environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly_test'
process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly_test'
process.env.STRIPE_PRICE_PREMIUM_MONTHLY = 'price_premium_monthly_test'
process.env.STRIPE_PRICE_PREMIUM_YEARLY = 'price_premium_yearly_test'
process.env.STRIPE_PRICE_FAMILY_MONTHLY = 'price_family_monthly_test'
process.env.STRIPE_PRICE_FAMILY_YEARLY = 'price_family_yearly_test'
process.env.STRIPE_PRICE_ID = 'price_premium_monthly_test'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
  usePathname: () => '/zugriff',
  useSearchParams: () => new URLSearchParams(),
}))

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
})

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// Close server after all tests
afterAll(() => {
  server.close()
})
