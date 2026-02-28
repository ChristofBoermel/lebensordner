import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { grantHealthDataConsent } from '@/lib/consent/manager'
import { CONSENT_VERSION } from '@/lib/consent/constants'
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
      endpoint: '/api/consent/grant-health-data',
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

    const result = await grantHealthDataConsent(user.id)

    if (!result.ok) {
      // Fallback: use user-scoped client if service-role flow fails.
      const { error: ledgerError } = await supabase
        .from('consent_ledger')
        .insert({
          user_id: user.id,
          consent_type: 'health_data',
          granted: true,
          version: CONSENT_VERSION,
        })

      if (ledgerError) {
        console.error('[CONSENT] Fallback ledger insert failed:', ledgerError)
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          health_data_consent_granted: true,
          health_data_consent_timestamp: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) {
        console.error('[CONSENT] Fallback profile update failed (continuing):', profileError)
      }
    }

    await incrementRateLimit({
      identifier: `consent_ip:${clientIp}`,
      endpoint: '/api/consent/grant-health-data',
      ...RATE_LIMIT_API,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONSENT] Grant health data error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
