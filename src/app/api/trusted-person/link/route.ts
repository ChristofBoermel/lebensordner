import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Service role client to update trusted_persons when RLS blocks user-scoped writes.
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env['SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return null
  }

  return createClient(
    supabaseUrl,
    serviceKey
  )
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    if (!user.email) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'Keine E-Mail am Konto vorhanden, keine Verknüpfung möglich',
      })
    }

    // 1) Try user-scoped linking first (works when DB policies allow invitee self-linking).
    const { data: userUpdateRows, error: userUpdateError } = await supabase
      .from('trusted_persons')
      .update({ linked_user_id: user.id })
      .ilike('email', user.email)
      .eq('invitation_status', 'accepted')
      .is('linked_user_id', null)
      .select('id')

    if (!userUpdateError) {
      const linkedCount = userUpdateRows?.length ?? 0
      return NextResponse.json({
        success: true,
        linked: linkedCount,
        message: linkedCount > 0
          ? `${linkedCount} Verknüpfung(en) erstellt`
          : 'Keine ausstehenden Verknüpfungen gefunden',
      })
    }

    console.warn('User-scoped trusted-person linking failed, trying admin fallback:', userUpdateError)

    // 2) Fallback: service-role update for environments where invitee self-linking is blocked by RLS.
    const adminClient = getSupabaseAdmin()
    if (!adminClient) {
      console.error('Missing service-role client config for trusted-person link fallback')
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'Verknüpfung derzeit nicht möglich (Konfiguration)',
      })
    }

    const { data: adminUpdateRows, error: adminUpdateError } = await adminClient
      .from('trusted_persons')
      .update({ linked_user_id: user.id })
      .ilike('email', user.email)
      .eq('invitation_status', 'accepted')
      .is('linked_user_id', null)
      .select('id')

    if (adminUpdateError) {
      console.error('Admin fallback trusted-person linking failed:', adminUpdateError)
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'Verknüpfung derzeit nicht möglich',
      })
    }

    const linkedCount = adminUpdateRows?.length ?? 0

    return NextResponse.json({
      success: true,
      linked: linkedCount,
      message: linkedCount > 0
        ? `${linkedCount} Verknüpfung(en) erstellt`
        : 'Keine ausstehenden Verknüpfungen gefunden',
    })
  } catch (error: any) {
    console.error('Link trusted person error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
