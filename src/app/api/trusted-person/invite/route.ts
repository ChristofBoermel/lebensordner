import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { trustedPersonId } = await request.json()

    // Get trusted person details
    const { data: trustedPerson, error: fetchError } = await supabase
      .from('trusted_persons')
      .select('*')
      .eq('id', trustedPersonId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !trustedPerson) {
      return NextResponse.json({ error: 'Vertrauensperson nicht gefunden' }, { status: 404 })
    }

    // Get owner profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    // Generate invitation token if not exists
    const invitationToken = trustedPerson.invitation_token || crypto.randomUUID()

    // Update trusted person with invitation details
    const { error: updateError } = await supabase
      .from('trusted_persons')
      .update({
        invitation_token: invitationToken,
        invitation_sent_at: new Date().toISOString(),
        invitation_status: 'sent',
      })
      .eq('id', trustedPersonId)

    if (updateError) {
      throw updateError
    }

    // In a real app, you would send an email here via Resend/SendGrid
    // For now, we'll return the invitation link
    const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/einladung/${invitationToken}`

    // TODO: Send email via Resend
    // await sendInvitationEmail({
    //   to: trustedPerson.email,
    //   ownerName: profile?.full_name || 'Jemand',
    //   invitationLink,
    // })

    return NextResponse.json({ 
      success: true, 
      invitationLink,
      message: 'Einladung wurde gesendet'
    })
  } catch (error: any) {
    console.error('Invitation error:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Senden der Einladung' },
      { status: 500 }
    )
  }
}
