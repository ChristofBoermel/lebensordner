import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const getResend = () => new Resend(process.env.RESEND_API_KEY)

interface CreateDownloadLinkRequest {
  recipientName: string
  recipientEmail: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { recipientName, recipientEmail } = await request.json() as CreateDownloadLinkRequest

    if (!recipientName || !recipientEmail) {
      return NextResponse.json(
        { error: 'Name und E-Mail sind erforderlich' },
        { status: 400 }
      )
    }

    // Get user profile for the email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const senderName = profile?.full_name || profile?.email || 'Unbekannt'

    // Generate a secure random token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours

    const adminClient = getSupabaseAdmin()

    // Create the download token
    const { error: insertError } = await adminClient
      .from('download_tokens')
      .insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        recipient_name: recipientName,
        recipient_email: recipientEmail,
      })

    if (insertError) {
      console.error('Error creating download token:', insertError)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Download-Links' },
        { status: 500 }
      )
    }

    // Create the download URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'
    const downloadUrl = `${baseUrl}/herunterladen/${token}`

    // Send email to recipient
    try {
      await getResend().emails.send({
        from: 'Lebensordner <noreply@lebensordner.org>',
        to: recipientEmail,
        subject: `${senderName} teilt Dokumente mit Ihnen`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background-color: #5d6b5d; padding: 12px; border-radius: 12px;">
                <span style="color: white; font-size: 24px;">&#127807;</span>
              </div>
              <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
            </div>

            <p style="color: #374151;">Hallo ${recipientName},</p>

            <p style="color: #374151;">
              <strong>${senderName}</strong> hat Dokumente mit Ihnen geteilt.
            </p>

            <p style="color: #374151;">
              Klicken Sie auf den folgenden Link, um alle Dokumente als ZIP-Datei herunterzuladen:
            </p>

            <div style="margin: 24px 0; text-align: center;">
              <a href="${downloadUrl}"
                 style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500;">
                Dokumente herunterladen
              </a>
            </div>

            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 0; color: #92400e; font-weight: 500;">
                Wichtiger Hinweis:
              </p>
              <p style="margin: 8px 0 0 0; color: #92400e;">
                Dieser Link ist <strong>12 Stunden</strong> gültig und kann nur einmal verwendet werden.
                Der Link läuft ab am: <strong>${expiresAt.toLocaleDateString('de-DE')} um ${expiresAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</strong>
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              Wenn Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren.
              Der Link funktioniert nur, wenn Sie ihn öffnen.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Diese E-Mail wurde automatisch von Lebensordner gesendet.
            </p>
          </body>
          </html>
        `,
      })
    } catch (emailError) {
      console.error('Error sending download link email:', emailError)
      // Continue anyway - the link was created
    }

    return NextResponse.json({
      success: true,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
      message: 'Download-Link wurde erstellt und per E-Mail gesendet',
    })
  } catch (error: any) {
    console.error('Create download link error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
