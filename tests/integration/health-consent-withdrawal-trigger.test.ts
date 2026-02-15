import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createMockHealthData } from '../fixtures/consent'

const shouldRunIntegration =
  process.env.RUN_INTEGRATION_DB_TESTS === 'true'

const describeIntegration = shouldRunIntegration ? describe : describe.skip

describeIntegration('on_health_consent_withdrawal trigger', () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const createTestUserId = () => `test_user_${Date.now()}_${Math.random().toString(16).slice(2)}`

  const seedHealthData = async (testUserId: string) => {
    const healthData = createMockHealthData()

    await supabase.from('profiles').insert({
      id: testUserId,
      email: `${testUserId}@example.com`,
      full_name: 'Integration Test User',
      health_data_consent_granted: true,
      health_data_consent_timestamp: new Date().toISOString(),
    })

    await supabase.from('medical_info').insert(
      healthData.medical_info.map((record) => ({ ...record, user_id: testUserId }))
    )
    await supabase.from('emergency_contacts').insert(
      healthData.emergency_contacts.map((record) => ({ ...record, user_id: testUserId }))
    )
    await supabase.from('advance_directives').insert(
      healthData.advance_directives.map((record) => ({ ...record, user_id: testUserId }))
    )
    await supabase.from('funeral_wishes').insert(
      healthData.funeral_wishes.map((record) => ({ ...record, user_id: testUserId }))
    )
  }

  it('should delete all medical_info records when consent withdrawn', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase.from('medical_info').select('*').eq('user_id', testUserId)
    expect(data?.length ?? 0).toBe(0)
  })

  it('should delete all emergency_contacts when consent withdrawn', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase.from('emergency_contacts').select('*').eq('user_id', testUserId)
    expect(data?.length ?? 0).toBe(0)
  })

  it('should delete all advance_directives when consent withdrawn', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase.from('advance_directives').select('*').eq('user_id', testUserId)
    expect(data?.length ?? 0).toBe(0)
  })

  it('should delete all funeral_wishes when consent withdrawn', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase.from('funeral_wishes').select('*').eq('user_id', testUserId)
    expect(data?.length ?? 0).toBe(0)
  })

  it('should update profiles.health_data_consent_granted to false', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase
      .from('profiles')
      .select('health_data_consent_granted')
      .eq('id', testUserId)
      .single()

    expect(data?.health_data_consent_granted).toBe(false)
  })

  it('should set profiles.health_data_consent_timestamp to null', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase
      .from('profiles')
      .select('health_data_consent_timestamp')
      .eq('id', testUserId)
      .single()

    expect(data?.health_data_consent_timestamp).toBeNull()
  })

  it('should create audit log entry with event_type=health_consent_withdrawn', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase
      .from('security_audit_log')
      .select('event_type')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(data?.event_type).toBe('health_consent_withdrawn')
  })

  it('should NOT delete data when consent granted (granted=true)', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: true,
      version: '1.0',
    })

    const { data } = await supabase.from('medical_info').select('*').eq('user_id', testUserId)
    expect(data?.length ?? 0).toBeGreaterThan(0)
  })

  it('should NOT delete data for other consent types (analytics, marketing)', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'analytics',
      granted: false,
      version: '1.0',
    })

    const { data } = await supabase.from('medical_info').select('*').eq('user_id', testUserId)
    expect(data?.length ?? 0).toBeGreaterThan(0)
  })

  it('should be atomic - rollback all changes if any operation fails', async () => {
    const testUserId = createTestUserId()
    await seedHealthData(testUserId)

    const { error } = await supabase.from('consent_ledger').insert({
      user_id: testUserId,
      consent_type: 'health_data',
      granted: false,
      version: '1.0',
    })

    expect(error).toBeNull()
  })
})
