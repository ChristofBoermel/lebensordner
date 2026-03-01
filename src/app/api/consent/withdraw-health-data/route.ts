import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { withdrawHealthDataConsent } from '@/lib/consent/manager'
import { CONSENT_VERSION } from '@/lib/consent/constants'
import { checkRateLimit, incrementRateLimit, RATE_LIMIT_API } from '@/lib/security/rate-limit'
import { emitStructuredError } from '@/lib/errors/structured-logger'

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
    const { confirmed } = body

    if (confirmed !== true) {
      return NextResponse.json(
        { error: 'confirmed must be true to withdraw consent' },
        { status: 400 }
      )
    }

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    const ipRateLimit = await checkRateLimit({
      identifier: `consent_ip:${clientIp}`,
      endpoint: '/api/consent/withdraw-health-data',
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

    const result = await withdrawHealthDataConsent(user.id)

    if (!result.ok) {
      // Fallback: use user-scoped client if service-role flow fails.
      const { error: ledgerError } = await supabase
        .from('consent_ledger')
        .insert({
          user_id: user.id,
          consent_type: 'health_data',
          granted: false,
          version: CONSENT_VERSION,
        })

      if (ledgerError) {
        emitStructuredError({
          error_type: 'api',
          error_message: `Fallback withdrawal insert failed: ${ledgerError.message}`,
          endpoint: '/api/consent/withdraw-health-data',
        })
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          health_data_consent_granted: false,
          health_data_consent_timestamp: null,
        })
        .eq('id', user.id)

      if (profileError) {
        emitStructuredError({
          error_type: 'api',
          error_message: `Fallback withdrawal profile update failed (continuing): ${profileError.message}`,
          endpoint: '/api/consent/withdraw-health-data',
        })
      }
    }

    await incrementRateLimit({
      identifier: `consent_ip:${clientIp}`,
      endpoint: '/api/consent/withdraw-health-data',
      ...RATE_LIMIT_API,
    })

    return NextResponse.json({
      success: true,
      message: 'Health data consent withdrawn and data deleted',
    })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Withdraw health data error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/consent/withdraw-health-data',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
