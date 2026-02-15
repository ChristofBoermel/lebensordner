import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    const { data, error } = await supabase
      .from('profiles')
      .select('health_data_consent_granted, health_data_consent_timestamp')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[CONSENT] Health consent check error:', error)
      return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      granted: data?.health_data_consent_granted === true,
      timestamp: data?.health_data_consent_timestamp ?? null,
    })
  } catch (error) {
    console.error('[CONSENT] Health consent check error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
