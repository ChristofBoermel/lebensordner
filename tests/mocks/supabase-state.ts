// Mutable state for Supabase mock data
// This is used by the mocked Supabase client to return different profile data

export interface MockProfileData {
  id: string
  email: string
  full_name: string | null
  subscription_status: string | null
  stripe_price_id: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export let mockProfileData: MockProfileData = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  subscription_status: null,
  stripe_price_id: null,
  stripe_customer_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export function setMockProfileData(data: Partial<MockProfileData>) {
  mockProfileData = { ...mockProfileData, ...data }
  const globalAny = globalThis as typeof globalThis & { __PROFILE_VERSION__?: number }
  globalAny.__PROFILE_VERSION__ = (globalAny.__PROFILE_VERSION__ ?? 0) + 1
}

export function resetMockProfileData() {
  mockProfileData = {
    id: 'test-user-id',
    email: 'test@example.com',
    full_name: 'Test User',
    subscription_status: null,
    stripe_price_id: null,
    stripe_customer_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const globalAny = globalThis as typeof globalThis & { __PROFILE_VERSION__?: number }
  globalAny.__PROFILE_VERSION__ = (globalAny.__PROFILE_VERSION__ ?? 0) + 1
}
