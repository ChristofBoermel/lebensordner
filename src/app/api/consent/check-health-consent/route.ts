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
