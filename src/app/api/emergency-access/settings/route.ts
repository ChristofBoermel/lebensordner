import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canPerformAction, getTierFromSubscription } from '@/lib/subscription-tiers'
import { emitStructuredError } from '@/lib/errors/structured-logger'

type EmergencyDays = 30 | 60 | 90

interface SettingsPayload {
  enabled: boolean
  days: EmergencyDays
  trustedPersonId: string | null
}

function isValidDays(value: unknown): value is EmergencyDays {
  return value === 30 || value === 60 || value === 90
}

export async function GET() {
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
        subscription_status,
        stripe_price_id,
        emergency_access_enabled,
        emergency_access_days,
        emergency_access_trusted_person_id,
        emergency_access_notified_at,
        last_active_at
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

    const { data: trustedPersons, error: trustedPersonsError } = await supabase
      .from('trusted_persons')
      .select('id, name, email, relationship, invitation_status')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (trustedPersonsError) {
      return NextResponse.json({ error: 'Vertrauenspersonen konnten nicht geladen werden' }, { status: 500 })
    }

    return NextResponse.json({
      enabled: Boolean(profile.emergency_access_enabled),
      days: profile.emergency_access_days as EmergencyDays,
      trustedPersonId: profile.emergency_access_trusted_person_id,
      notifiedAt: profile.emergency_access_notified_at,
      lastActiveAt: profile.last_active_at,
      trustedPersons: trustedPersons || [],
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Emergency access settings GET failed: ${error?.message ?? String(error)}`,
      endpoint: '/api/emergency-access/settings',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const body = (await request.json()) as Partial<SettingsPayload>
    if (typeof body.enabled !== 'boolean' || !isValidDays(body.days)) {
      return NextResponse.json({ error: 'Ungültige Eingabedaten' }, { status: 400 })
    }
    const trustedPersonId = body.trustedPersonId ?? null

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status, stripe_price_id, emergency_access_enabled')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
    }

    const tier = getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
    if (!canPerformAction(tier, 'useEmergencyAccess')) {
      return NextResponse.json({ error: 'vorsorge_required' }, { status: 403 })
    }

    if (body.enabled) {
      if (!trustedPersonId) {
        return NextResponse.json({ error: 'trusted_person_required' }, { status: 400 })
      }

      const { data: trustedPerson, error: trustedPersonError } = await supabase
        .from('trusted_persons')
        .select('id, invitation_status')
        .eq('id', trustedPersonId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (trustedPersonError || !trustedPerson) {
        return NextResponse.json({ error: 'trusted_person_invalid' }, { status: 400 })
      }
      if (trustedPerson.invitation_status !== 'accepted') {
        return NextResponse.json({ error: 'trusted_person_not_accepted' }, { status: 400 })
      }
    }

    const updatePayload: Record<string, unknown> = {
      emergency_access_enabled: body.enabled,
      emergency_access_days: body.days,
      emergency_access_trusted_person_id: trustedPersonId,
    }

    if (body.enabled && !profile.emergency_access_enabled) {
      updatePayload.emergency_access_notified_at = null
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }

    const { data: updated } = await supabase
      .from('profiles')
      .select(
        `
        emergency_access_enabled,
        emergency_access_days,
        emergency_access_trusted_person_id,
        emergency_access_notified_at,
        last_active_at
      `
      )
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      enabled: Boolean(updated?.emergency_access_enabled),
      days: updated?.emergency_access_days as EmergencyDays,
      trustedPersonId: updated?.emergency_access_trusted_person_id ?? null,
      notifiedAt: updated?.emergency_access_notified_at ?? null,
      lastActiveAt: updated?.last_active_at ?? null,
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Emergency access settings POST failed: ${error?.message ?? String(error)}`,
      endpoint: '/api/emergency-access/settings',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
