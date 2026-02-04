import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const trustedPersonId = searchParams.get('trustedPersonId')

    if (!trustedPersonId) {
      return NextResponse.json(
        { error: 'trustedPersonId parameter required' },
        { status: 400 }
      )
    }

    // Fetch trusted person with email status - verify ownership
    const { data: trustedPerson, error } = await supabase
      .from('trusted_persons')
      .select('id, email_status, email_sent_at, email_error, email_retry_count, invitation_status')
      .eq('id', trustedPersonId)
      .eq('user_id', user.id)
      .single()

    if (error || !trustedPerson) {
      return NextResponse.json(
        { error: 'Vertrauensperson nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      status: trustedPerson.email_status,
      sentAt: trustedPerson.email_sent_at,
      error: trustedPerson.email_error,
      retryCount: trustedPerson.email_retry_count,
      invitationStatus: trustedPerson.invitation_status,
    })
  } catch (error: any) {
    console.error('Invite status error:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Abrufen des Status' },
      { status: 500 }
    )
  }
}
