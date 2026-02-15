import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { recordConsent } from '@/lib/consent/manager'
import { PRIVACY_POLICY_VERSION } from '@/lib/consent/constants'
import { checkRateLimit, incrementRateLimit, RATE_LIMIT_API } from '@/lib/security/rate-limit'

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

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    const ipRateLimit = await checkRateLimit({
      identifier: `consent_ip:${clientIp}`,
      endpoint: '/api/consent/accept-privacy-policy',
      ...RATE_LIMIT_API,
    })

    if (!ipRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (ipRateLimit.resetAt.getTime() - Date.now()) / 1000
      )
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfterSeconds },
        { status: 429 }
      )
    }

    const consentResult = await recordConsent(user.id, 'privacy_policy', true, PRIVACY_POLICY_VERSION)
    if (!consentResult.ok) {
      return NextResponse.json(
        { error: consentResult.error },
        { status: 500 }
      )
    }

    await incrementRateLimit({
      identifier: `consent_ip:${clientIp}`,
      endpoint: '/api/consent/accept-privacy-policy',
      ...RATE_LIMIT_API,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONSENT] Accept privacy policy error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
