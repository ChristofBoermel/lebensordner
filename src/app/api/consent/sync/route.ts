import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { recordConsent } from '@/lib/consent/manager'
import { CONSENT_VERSION, CONSENT_COOKIE_NAME } from '@/lib/consent/constants'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const cookieStore = await cookies()
    const consentCookie = cookieStore.get(CONSENT_COOKIE_NAME)

    if (!consentCookie?.value) {
      return NextResponse.json(
        { error: 'No consent cookie found' },
        { status: 400 }
      )
    }

    let consent: { analytics?: boolean; marketing?: boolean; version?: string }
    try {
      consent = JSON.parse(consentCookie.value)
    } catch {
      return NextResponse.json(
        { error: 'Invalid consent cookie format' },
        { status: 400 }
      )
    }

    const version = consent.version || CONSENT_VERSION

    // Record analytics consent if present
    if (typeof consent.analytics === 'boolean') {
      await recordConsent(user.id, 'analytics', consent.analytics, version)
    }

    // Record marketing consent if present
    if (typeof consent.marketing === 'boolean') {
      await recordConsent(user.id, 'marketing', consent.marketing, version)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONSENT] Sync error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
