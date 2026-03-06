import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canPerformAction, getTierFromSubscription } from '@/lib/subscription-tiers'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import { generateEmergencyAccessEmail } from '@/lib/email/emergency-access'

const TEST_EMAIL_INTERVAL_MS = 24 * 60 * 60 * 1000

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY missing')
  }
  return new Resend(apiKey)
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(
        `
        email,
        full_name,
        subscription_status,
        stripe_price_id,
        emergency_access_trusted_person_id,
        emergency_access_test_sent_at
      `
      )
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
    }

    const tier = getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
    if (!canPerformAction(tier, 'useEmergencyAccess')) {
      return NextResponse.json({ error: 'vorsorge_required' }, { status: 403 })
    }

    if (!profile.emergency_access_trusted_person_id) {
      return NextResponse.json({ error: 'trusted_person_required' }, { status: 400 })
    }

    const lastTestSentAt = profile.emergency_access_test_sent_at
      ? new Date(profile.emergency_access_test_sent_at).getTime()
      : null
    if (lastTestSentAt && Date.now() - lastTestSentAt < TEST_EMAIL_INTERVAL_MS) {
      return NextResponse.json({ error: 'test_rate_limited' }, { status: 429 })
    }

    const { data: trustedPerson, error: trustedPersonError } = await supabase
      .from('trusted_persons')
      .select('id, name, email, invitation_status, invitation_token')
      .eq('id', profile.emergency_access_trusted_person_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (trustedPersonError || !trustedPerson) {
      return NextResponse.json({ error: 'trusted_person_invalid' }, { status: 400 })
    }
    if (trustedPerson.invitation_status !== 'accepted') {
      return NextResponse.json({ error: 'trusted_person_not_accepted' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'
    const accessUrl = trustedPerson.invitation_token
      ? `${appUrl}/einladung/${trustedPerson.invitation_token}`
      : `${appUrl}/zugriff`

    await getResend().emails.send({
      from: 'Lebensordner <noreply@lebensordner.de>',
      to: trustedPerson.email,
      subject: `Wichtige Mitteilung: Zugang zu ${(profile.full_name || profile.email)}s Lebensordner`,
      html: generateEmergencyAccessEmail({
        ownerName: profile.full_name || profile.email,
        ownerEmail: profile.email,
        trustedPersonName: trustedPerson.name,
        daysSinceActive: 0,
        accessUrl,
        isTest: true,
      }),
    })

    await supabase
      .from('profiles')
      .update({ emergency_access_test_sent_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Emergency access test email failed: ${error?.message ?? String(error)}`,
      endpoint: '/api/emergency-access/test',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
