import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Service role client to update trusted_persons
const getSupabaseAdmin = () => {
  return createClient(
    process.env['SUPABASE_URL']!,
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
    // Use ilike for case-insensitive email matching
    const { data: pendingLinks, error: fetchError } = await adminClient
      .from('trusted_persons')
      .select('id, user_id, name, email, invitation_status')
      .ilike('email', user.email || '')
      .is('linked_user_id', null)

    console.log('Link API - User email:', user.email)
    console.log('Link API - Found pending links:', pendingLinks)

    if (fetchError) {
      console.error('Error fetching pending links:', fetchError)
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }

    // Filter to only accepted invitations
    const acceptedLinks = (pendingLinks || []).filter(
      link => link.invitation_status === 'accepted'
    )

    if (acceptedLinks.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'Keine ausstehenden Verknüpfungen gefunden',
        debug: { userEmail: user.email, foundRecords: pendingLinks?.length || 0 }
      })
    }

    // Link all matching records by their IDs
    const idsToLink = acceptedLinks.map(link => link.id)
    const { error: updateError } = await adminClient
      .from('trusted_persons')
      .update({ linked_user_id: user.id })
      .in('id', idsToLink)

    if (updateError) {
      console.error('Error linking trusted person:', updateError)
      return NextResponse.json({ error: 'Verknüpfung fehlgeschlagen' }, { status: 500 })
    }

    console.log(`Linked ${acceptedLinks.length} trusted person record(s) for user ${user.id}`)

    return NextResponse.json({
      success: true,
      linked: acceptedLinks.length,
      message: `${acceptedLinks.length} Verknüpfung(en) erstellt`
    })
  } catch (error: any) {
    console.error('Link trusted person error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
