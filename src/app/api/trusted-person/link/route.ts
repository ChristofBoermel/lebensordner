import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Service role client to update trusted_persons
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const adminClient = getSupabaseAdmin()

    // Find any trusted_persons records where email matches and invitation was accepted
    // but linked_user_id is not yet set
    const { data: pendingLinks, error: fetchError } = await adminClient
      .from('trusted_persons')
      .select('id, user_id, name')
      .eq('email', user.email)
      .eq('invitation_status', 'accepted')
      .is('linked_user_id', null)

    if (fetchError) {
      console.error('Error fetching pending links:', fetchError)
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }

    if (!pendingLinks || pendingLinks.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'Keine ausstehenden Verknüpfungen gefunden'
      })
    }

    // Link all matching records
    const { error: updateError } = await adminClient
      .from('trusted_persons')
      .update({ linked_user_id: user.id })
      .eq('email', user.email)
      .eq('invitation_status', 'accepted')
      .is('linked_user_id', null)

    if (updateError) {
      console.error('Error linking trusted person:', updateError)
      return NextResponse.json({ error: 'Verknüpfung fehlgeschlagen' }, { status: 500 })
    }

    console.log(`Linked ${pendingLinks.length} trusted person record(s) for user ${user.id}`)

    return NextResponse.json({
      success: true,
      linked: pendingLinks.length,
      message: `${pendingLinks.length} Verknüpfung(en) erstellt`
    })
  } catch (error: any) {
    console.error('Link trusted person error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
