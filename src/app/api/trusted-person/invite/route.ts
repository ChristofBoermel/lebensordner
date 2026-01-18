import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

    const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lebensordner.org'}/einladung/${invitationToken}`
    const ownerName = profile?.full_name || 'Jemand'

    // Send invitation email via Resend
    try {
      await resend.emails.send({
        from: 'Lebensordner <einladung@lebensordner.org>',
        to: trustedPerson.email,
        subject: `${ownerName} hat Sie als Vertrauensperson eingeladen`,
        html: generateInvitationEmail({
          trustedPersonName: trustedPerson.name,
          ownerName,
          invitationLink,
          relationship: trustedPerson.relationship || 'Vertrauensperson',
        }),
      })
      
      console.log('Invitation email sent to:', trustedPerson.email)
    } catch (emailError: any) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the request if email fails, just log it
      // The invitation link is still valid
    }

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

interface InvitationEmailData {
  trustedPersonName: string
  ownerName: string
  invitationLink: string
  relationship: string
}

function generateInvitationEmail(data: InvitationEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #5d6b5d; padding: 12px; border-radius: 12px;">
        <span style="color: white; font-size: 24px;">🌿</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
    </div>

    <!-- Content Card -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">
        Hallo ${data.trustedPersonName},
      </p>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        <strong>${data.ownerName}</strong> hat Sie als <strong>${data.relationship}</strong> zu ihrem Lebensordner hinzugefügt.
      </p>

      <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">🔐 Was bedeutet das?</h3>
        <ul style="color: #374151; font-size: 14px; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Sie können im Notfall auf wichtige Dokumente zugreifen</li>
          <li style="margin-bottom: 8px;">Sie sehen nur die für Sie freigegebenen Informationen</li>
          <li>Sie können jederzeit den Zugriff beenden</li>
        </ul>
      </div>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Klicken Sie auf den Button unten, um die Einladung anzunehmen und sich zu registrieren:
      </p>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.invitationLink}" 
           style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Einladung annehmen →
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
        Oder kopieren Sie diesen Link:<br>
        <a href="${data.invitationLink}" style="color: #5d6b5d; word-break: break-all;">
          ${data.invitationLink}
        </a>
      </p>
    </div>

    <!-- Security Notice -->
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="color: #92400e; font-size: 13px; margin: 0;">
        <strong>⚠️ Sicherheitshinweis:</strong> Wenn Sie diese Person nicht kennen oder die Einladung nicht erwartet haben, 
        ignorieren Sie bitte diese E-Mail.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        Lebensordner - Ihr digitaler Lebensordner für wichtige Dokumente
      </p>
      <p style="margin: 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lebensordner.org'}" style="color: #6b7280;">
          www.lebensordner.org
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}
