import { createClient } from '@supabase/supabase-js'

// --- Interfaces ---

export interface ConsentRecord {
  id: string
  user_id: string
  consent_type: 'analytics' | 'marketing'
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
  consentType: 'analytics' | 'marketing',
  granted: boolean,
  version: string
): Promise<void> {
  try {
    const supabase = createServiceClient()

    await supabase
      .from('consent_ledger')
      .insert({
        user_id: userId,
        consent_type: consentType,
        granted,
        version,
      })
  } catch (error) {
    console.error('Failed to record consent:', error)
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
  consentType: 'analytics' | 'marketing'
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
