import { createClient } from '@supabase/supabase-js'
import { CONSENT_VERSION } from '@/lib/consent/constants'

// --- Interfaces ---

export interface ConsentRecord {
  id: string
  user_id: string
  consent_type: 'analytics' | 'marketing' | 'privacy_policy' | 'health_data'
  granted: boolean
  version: string
  timestamp: string
}

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// --- Functions ---

export async function recordConsent(
  userId: string,
  consentType: 'analytics' | 'marketing' | 'privacy_policy' | 'health_data',
  granted: boolean,
  version: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('consent_ledger')
      .insert({
        user_id: userId,
        consent_type: consentType,
        granted,
        version,
      })

    if (error) {
      console.error('Failed to record consent:', error)
      return { ok: false, error: 'Failed to record consent' }
    }

    return { ok: true }
  } catch (error) {
    console.error('Failed to record consent:', error)
    return { ok: false, error: 'Failed to record consent' }
  }
}

export async function getConsentHistory(userId: string): Promise<ConsentRecord[]> {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('consent_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Failed to fetch consent history:', error)
      return []
    }

    return (data || []) as ConsentRecord[]
  } catch (error) {
    console.error('Failed to fetch consent history:', error)
    return []
  }
}

export async function getCurrentConsent(
  userId: string,
  consentType: 'analytics' | 'marketing' | 'privacy_policy' | 'health_data'
): Promise<ConsentRecord | null> {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('consent_ledger')
      .select('*')
      .eq('user_id', userId)
      .eq('consent_type', consentType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return null
    }

    return data as ConsentRecord
  } catch (error) {
    console.error('Failed to fetch current consent:', error)
    return null
  }
}

export async function hasHealthDataConsent(userId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('health_data_consent_granted')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to fetch health data consent:', error)
      return false
    }

    return data?.health_data_consent_granted === true
  } catch (error) {
    console.error('Failed to fetch health data consent:', error)
    return false
  }
}

export async function grantHealthDataConsent(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createServiceClient()

    const { error: ledgerError } = await supabase
      .from('consent_ledger')
      .insert({
        user_id: userId,
        consent_type: 'health_data',
        granted: true,
        version: CONSENT_VERSION,
      })

    if (ledgerError) {
      console.error('Failed to record health data consent:', ledgerError)
      return { ok: false, error: 'Failed to record health data consent' }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        health_data_consent_granted: true,
        health_data_consent_timestamp: new Date().toISOString(),
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Failed to update health data consent profile:', profileError)
      return { ok: false, error: 'Failed to update health data consent profile' }
    }

    return { ok: true }
  } catch (error) {
    console.error('Failed to grant health data consent:', error)
    return { ok: false, error: 'Failed to grant health data consent' }
  }
}

export async function withdrawHealthDataConsent(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('consent_ledger')
      .insert({
        user_id: userId,
        consent_type: 'health_data',
        granted: false,
        version: CONSENT_VERSION,
      })

    if (error) {
      console.error('Failed to record health data withdrawal:', error)
      return { ok: false, error: 'Failed to record health data withdrawal' }
    }

    return { ok: true }
  } catch (error) {
    console.error('Failed to withdraw health data consent:', error)
    return { ok: false, error: 'Failed to withdraw health data consent' }
  }
}
