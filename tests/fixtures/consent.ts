import type { ConsentRecord } from '@/lib/consent/manager'
import type { Profile } from '@/types/database'

export const createMockConsentRecord = (
  overrides: Partial<ConsentRecord> = {}
): ConsentRecord => ({
  id: overrides.id ?? 'consent_test_1',
  user_id: overrides.user_id ?? 'user_test_1',
  consent_type: overrides.consent_type ?? 'health_data',
  granted: overrides.granted ?? true,
  version: overrides.version ?? '1.0',
  timestamp: overrides.timestamp ?? new Date().toISOString(),
})

export const createMockProfile = (
  overrides: Partial<Profile> = {}
): Profile => ({
  id: overrides.id ?? 'user_test_1',
  email: overrides.email ?? 'user@example.com',
  full_name: overrides.full_name ?? 'Test User',
  subscription_status: overrides.subscription_status ?? null,
  stripe_customer_id: overrides.stripe_customer_id ?? null,
  stripe_price_id: overrides.stripe_price_id ?? null,
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
  health_data_consent_granted: overrides.health_data_consent_granted ?? false,
  health_data_consent_timestamp: overrides.health_data_consent_timestamp ?? null,
})

export const createMockHealthData = () => ({
  medical_info: [
    { id: 'med_1', user_id: 'user_test_1', diagnosis: 'Test Diagnosis' },
  ],
  emergency_contacts: [
    { id: 'contact_1', user_id: 'user_test_1', name: 'Test Contact' },
  ],
  advance_directives: [
    { id: 'directive_1', user_id: 'user_test_1', title: 'Directive' },
  ],
  funeral_wishes: [
    { id: 'wish_1', user_id: 'user_test_1', note: 'Wish' },
  ],
})
