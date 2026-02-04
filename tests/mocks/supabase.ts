import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  mockProfileData,
  setMockProfileData,
  resetMockProfileData,
  type MockProfileData,
} from './supabase-state'

// Re-export the type for consumers
export type MockProfile = MockProfileData

// Helper to set mock profile data (delegates to supabase-state)
export function setMockProfile(profile: Partial<MockProfile>) {
  resetMockProfileData()
  setMockProfileData(profile)
}

// Helper to reset mock profile data (delegates to supabase-state)
export function resetMockProfile() {
  resetMockProfileData()
}

// Mock authenticated user
export const mockAuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: new Date().toISOString(),
}

// MSW handlers for Supabase REST API
const handlers = [
  // GET profile by user ID
  http.get('https://test.supabase.co/rest/v1/profiles', ({ request }) => {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (id && id.includes(mockProfileData.id)) {
      return HttpResponse.json([mockProfileData])
    }

    return HttpResponse.json([mockProfileData])
  }),

  // GET single profile
  http.get('https://test.supabase.co/rest/v1/profiles*', () => {
    return HttpResponse.json(mockProfileData, {
      headers: {
        'Content-Range': '0-0/1',
      },
    })
  }),

  // Auth session endpoint
  http.get('https://test.supabase.co/auth/v1/user', () => {
    return HttpResponse.json(mockAuthUser)
  }),

  // Auth token refresh
  http.post('https://test.supabase.co/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      user: mockAuthUser,
    })
  }),
]

// Create MSW server
export const server = setupServer(...handlers)

// Helper functions for common subscription scenarios
export function setFreeUser() {
  setMockProfile({
    subscription_status: null,
    stripe_price_id: null,
  })
}

export function setBasicUser() {
  setMockProfile({
    subscription_status: 'active',
    stripe_price_id: process.env.STRIPE_PRICE_BASIC_MONTHLY || 'price_basic_monthly_test',
  })
}

export function setPremiumUser() {
  setMockProfile({
    subscription_status: 'active',
    stripe_price_id: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly_test',
  })
}

export function setPremiumYearlyUser() {
  setMockProfile({
    subscription_status: 'active',
    stripe_price_id: process.env.STRIPE_PRICE_PREMIUM_YEARLY || 'price_premium_yearly_test',
  })
}

export function setBasicYearlyUser() {
  setMockProfile({
    subscription_status: 'active',
    stripe_price_id: process.env.STRIPE_PRICE_BASIC_YEARLY || 'price_basic_yearly_test',
  })
}

export function setCanceledUser() {
  setMockProfile({
    subscription_status: 'canceled',
    stripe_price_id: 'price_premium_monthly_test',
  })
}

export function setTrialingUser() {
  setMockProfile({
    subscription_status: 'trialing',
    stripe_price_id: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly_test',
  })
}

export function setFamilyMonthlyUser() {
  setMockProfile({
    subscription_status: 'active',
    stripe_price_id: process.env.STRIPE_PRICE_FAMILY_MONTHLY || 'price_family_monthly_test',
  })
}

export function setFamilyYearlyUser() {
  setMockProfile({
    subscription_status: 'active',
    stripe_price_id: process.env.STRIPE_PRICE_FAMILY_YEARLY || 'price_family_yearly_test',
  })
}
