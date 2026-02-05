import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendEmailWithTimeout, DEFAULT_EMAIL_TIMEOUT_MS } from '@/lib/email/resend-service'

function generateWelcomeEmail({ userName }: { userName: string }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.lebensordner.org'
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
        <span style="color: white; font-size: 24px;">\ud83c\udf3f</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
    </div>

    <!-- Content Card -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 18px; margin: 0 0 24px 0;">
        Herzlich willkommen bei Lebensordner, ${userName}!
      </p>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Sie haben die Einrichtung erfolgreich abgeschlossen. Ihr digitaler Lebensordner ist jetzt bereit,
        Ihre wichtigen Dokumente sicher zu verwahren.
      </p>

      <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">Ihre n\u00e4chsten Schritte</h3>
        <ul style="color: #374151; font-size: 14px; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 10px;">
            <strong>Dokumente hochladen</strong> \u2013 Beginnen Sie mit Personalausweis oder Versicherungskarte
          </li>
          <li style="margin-bottom: 10px;">
            <strong>Vertrauensperson einladen</strong> \u2013 W\u00e4hlen Sie jemanden, der im Notfall Zugriff haben soll
          </li>
          <li style="margin-bottom: 10px;">
            <strong>Medizinische Daten erg\u00e4nzen</strong> \u2013 Blutgruppe, Allergien und Medikamente eintragen
          </li>
          <li>
            <strong>Notfall-QR-Code drucken</strong> \u2013 F\u00fcr Ihre Geldb\u00f6rse oder Krankenkassenkarte
          </li>
        </ul>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${appUrl}/dashboard"
           style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Dashboard \u2192
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
        Nehmen Sie sich Zeit und f\u00fcllen Sie Ihren Lebensordner Schritt f\u00fcr Schritt.
        Es gibt keine Eile \u2013 jeder kleine Schritt z\u00e4hlt.
      </p>
    </div>

    <!-- Help Section -->
    <div style="background-color: #f0f9ff; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="color: #1e40af; font-size: 13px; margin: 0;">
        <strong>\ud83d\udca1 Brauchen Sie Hilfe?</strong> Besuchen Sie unsere Hilfeseite unter
        <a href="${appUrl}/hilfe" style="color: #1e40af;">${appUrl}/hilfe</a>
        oder antworten Sie einfach auf diese E-Mail.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        Lebensordner - Ihr digitaler Lebensordner f\u00fcr wichtige Dokumente
      </p>
      <p style="margin: 0;">
        <a href="${appUrl}" style="color: #6b7280;">www.lebensordner.org</a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
    }

    const userEmail = profile.email || user.email
    if (!userEmail) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse vorhanden' }, { status: 400 })
    }

    const userName = profile.full_name || 'Nutzer'

    // Send welcome email
    const emailResult = await sendEmailWithTimeout(
      {
        from: 'Lebensordner <willkommen@lebensordner.org>',
        to: userEmail,
        subject: 'Willkommen bei Lebensordner - Ihre Anleitung',
        html: generateWelcomeEmail({ userName }),
      },
      DEFAULT_EMAIL_TIMEOUT_MS
    )

    if (emailResult.success || emailResult.pendingInFlight) {
      return NextResponse.json({
        success: true,
        message: 'Anleitung wurde gesendet',
      })
    }

    console.error('Guide email failed:', emailResult.error)
    const errorMessage = emailResult.error || 'Fehler beim Senden der Anleitung'
    const isRateLimited = /rate|too many|429/i.test(errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: isRateLimited ? 429 : 500 }
    )
  } catch (error: any) {
    console.error('Send guide error:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Senden der Anleitung' },
      { status: 500 }
    )
  }
}
