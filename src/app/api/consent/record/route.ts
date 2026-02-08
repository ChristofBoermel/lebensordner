import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { recordConsent } from '@/lib/consent/manager'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { consentType, granted, version } = body

    if (!consentType || typeof granted !== 'boolean' || !version) {
      return NextResponse.json(
        { error: 'consentType, granted, and version are required' },
        { status: 400 }
      )
    }

    if (!['analytics', 'marketing'].includes(consentType)) {
      return NextResponse.json(
        { error: 'consentType must be "analytics" or "marketing"' },
        { status: 400 }
      )
    }

    await recordConsent(user.id, consentType, granted, version)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONSENT] Record error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
