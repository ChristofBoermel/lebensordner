import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentConsent, hasHealthDataConsent } from '@/lib/consent/manager'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const [granted, latestHealthConsent] = await Promise.all([
      hasHealthDataConsent(user.id),
      getCurrentConsent(user.id, 'health_data'),
    ])

    if (!granted) {
      // Fallback: verify with user-scoped client in case service-role checks are unavailable.
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('health_data_consent_granted, health_data_consent_timestamp')
        .eq('id', user.id)
        .maybeSingle()

      if (!profileError && profileData?.health_data_consent_granted === true) {
        return NextResponse.json({
          granted: true,
          timestamp: profileData.health_data_consent_timestamp ?? null,
        })
      }

      const { data: ledgerData, error: ledgerError } = await supabase
        .from('consent_ledger')
        .select('granted, timestamp')
        .eq('user_id', user.id)
        .eq('consent_type', 'health_data')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!ledgerError && ledgerData?.granted === true) {
        return NextResponse.json({
          granted: true,
          timestamp: ledgerData.timestamp ?? null,
        })
      }
    }

    return NextResponse.json({
      granted,
      timestamp: latestHealthConsent?.timestamp ?? null,
    })
  } catch (error) {
    console.error('[CONSENT] Health consent check error:', error)
    return NextResponse.json(
      { granted: false, timestamp: null },
      { status: 200 }
    )
  }
}
