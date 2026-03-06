import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { canPerformAction, getTierFromSubscription } from '@/lib/subscription-tiers'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import { generateEmergencyAccessEmail } from '@/lib/email/emergency-access'

const CRON_SECRET = process.env.CRON_SECRET
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables missing')
  }
  return createClient(url, key)
}

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY missing')
  }
  return new Resend(apiKey)
}

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    emitStructuredError({
      error_type: 'auth',
      error_message: 'Request rejected: CRON_SECRET is not configured',
      endpoint: '/api/cron/check-emergency-access',
    })
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    emitStructuredWarn({
      event_type: 'auth',
      event_message: 'Unauthorized cron request rejected',
      endpoint: '/api/cron/check-emergency-access',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    checked: 0,
    eligible: 0,
    sent: 0,
    skippedRecentNotification: 0,
    skippedNotAccepted: 0,
    errors: [] as string[],
  }

  try {
    const supabase = getSupabaseAdmin()
    const resend = getResend()
    const now = new Date()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(
        `
        id,
        email,
        full_name,
        subscription_status,
        stripe_price_id,
        last_active_at,
        emergency_access_days,
        emergency_access_notified_at,
        emergency_access_trusted_person_id
      `
      )
      .eq('emergency_access_enabled', true)
      .not('last_active_at', 'is', null)
      .not('emergency_access_trusted_person_id', 'is', null)
      .in('subscription_status', ['active', 'trialing'])

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`)
    }

    for (const profile of profiles || []) {
      results.checked += 1

      const tier = getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
      if (!canPerformAction(tier, 'useEmergencyAccess')) {
        continue
      }

      const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : null
      if (!lastActive) {
        continue
      }

      const daysInactive = Math.floor((now.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000))
      if (daysInactive < profile.emergency_access_days) {
        continue
      }
      results.eligible += 1

      const notifiedAt = profile.emergency_access_notified_at
        ? new Date(profile.emergency_access_notified_at)
        : null
      if (notifiedAt && now.getTime() - notifiedAt.getTime() < THIRTY_DAYS_MS) {
        results.skippedRecentNotification += 1
        continue
      }

      const { data: trustedPerson, error: trustedPersonError } = await supabase
        .from('trusted_persons')
        .select('id, name, email, invitation_status, invitation_token')
        .eq('id', profile.emergency_access_trusted_person_id)
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .single()

      if (trustedPersonError || !trustedPerson || trustedPerson.invitation_status !== 'accepted') {
        results.skippedNotAccepted += 1
        continue
      }

      const accessUrl = trustedPerson.invitation_token
        ? `${appUrl}/einladung/${trustedPerson.invitation_token}`
        : `${appUrl}/zugriff`
      const ownerName = profile.full_name || profile.email

      try {
        await resend.emails.send({
          from: 'Lebensordner <noreply@lebensordner.de>',
          to: trustedPerson.email,
          subject: `Wichtige Mitteilung: Zugang zu ${ownerName}s Lebensordner`,
          html: generateEmergencyAccessEmail({
            ownerName,
            ownerEmail: profile.email,
            trustedPersonName: trustedPerson.name,
            daysSinceActive: daysInactive,
            accessUrl,
          }),
        })

        await supabase
          .from('profiles')
          .update({ emergency_access_notified_at: now.toISOString() })
          .eq('id', profile.id)

        results.sent += 1
      } catch (emailError: any) {
        results.errors.push(`email_failed:${profile.id}:${emailError?.message ?? String(emailError)}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'worker',
      error_message: `Emergency access cron failed: ${error?.message ?? String(error)}`,
      endpoint: '/api/cron/check-emergency-access',
      queue: 'emails',
      stack: error?.stack,
    })
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'Serverfehler',
        ...results,
      },
      { status: 500 }
    )
  }
}
