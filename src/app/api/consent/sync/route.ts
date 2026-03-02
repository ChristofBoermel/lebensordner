import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { recordConsent } from '@/lib/consent/manager'
import { CONSENT_VERSION, CONSENT_COOKIE_NAME } from '@/lib/consent/constants'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: cookieUser } } = await supabase.auth.getUser()

    let user = cookieUser

    // Fallback for immediate post-login requests where cookies may not be visible yet.
    if (!user) {
      const authHeader = request.headers.get('authorization')
      const bearerToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null

      if (bearerToken) {
        const { data: tokenData } = await supabase.auth.getUser(bearerToken)
        user = tokenData.user
      }
    }

    if (!user) {
      emitStructuredWarn({
        event_type: 'auth',
        event_message: 'Consent sync unauthorized',
        endpoint: '/api/consent/sync',
      })
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

    if (typeof consent.analytics === 'boolean') {
      await recordConsent(user.id, 'analytics', consent.analytics, version)
    }

    if (typeof consent.marketing === 'boolean') {
      await recordConsent(user.id, 'marketing', consent.marketing, version)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Consent sync error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/consent/sync',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
