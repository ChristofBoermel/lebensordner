import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/auth/tier-guard'
import { Resend } from 'resend'

const getResend = () => new Resend(process.env.RESEND_API_KEY)

// Category name translations
const CATEGORY_NAMES: Record<string, string> = {
  personal: 'Persönliche Daten',
  finance: 'Finanzen',
  insurance: 'Versicherungen',
  property: 'Immobilien',
  health: 'Gesundheit',
  legal: 'Rechtliches',
  digitalAccounts: 'Digitale Konten',
  family: 'Familie',
  employment: 'Arbeit & Beruf',
  memberships: 'Mitgliedschaften',
  other: 'Sonstiges',
}

interface NotifyWatcherRequest {
  documentId: string
  documentTitle: string
  category: string
  expiryDate: string
  watcherEmail: string
  watcherName: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const tier = await getUserTier()
    if (!tier.limits.familyDashboard) {
      return NextResponse.json(
        { error: 'Diese Funktion ist nur für Basic- und Premium-Nutzer verfügbar' },
        { status: 403 }
      )
    }

    const {
      documentTitle,
      category,
      expiryDate,
      watcherEmail,
      watcherName,
    } = await request.json() as NotifyWatcherRequest

    if (!documentTitle || !watcherEmail || !watcherName) {
      return NextResponse.json(
        { error: 'Fehlende Daten' },
        { status: 400 }
      )
    }

    // Get user profile for the email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const ownerName = profile?.full_name || profile?.email || 'Unbekannt'
    const categoryName = CATEGORY_NAMES[category] || category

    // Format the expiry date
    const expiryDateFormatted = new Date(expiryDate).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    // Send confirmation email to watcher
    try {
      await getResend().emails.send({
        from: 'Lebensordner <noreply@lebensordner.org>',
        to: watcherEmail,
        subject: `${ownerName} hat Sie als Erinnerungs-Begleiter hinzugefügt`,
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

            <p style="color: #374151;">Hallo ${watcherName},</p>

            <p style="color: #374151;">
              <strong>${ownerName}</strong> hat Sie gebeten, einen wichtigen Termin im Blick zu behalten.
            </p>

            <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <h2 style="margin: 0 0 12px 0; color: #166534; font-size: 18px;">Termindetails</h2>
              <table style="width: 100%; color: #374151;">
                <tr>
                  <td style="padding: 4px 0; font-weight: 500;">Dokument:</td>
                  <td style="padding: 4px 0;">${documentTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-weight: 500;">Kategorie:</td>
                  <td style="padding: 4px 0;">${categoryName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-weight: 500;">Ablaufdatum:</td>
                  <td style="padding: 4px 0;"><strong>${expiryDateFormatted}</strong></td>
                </tr>
              </table>
            </div>

            <p style="color: #374151;">
              Sie werden automatisch per E-Mail benachrichtigt, wenn der Termin näher rückt.
              Bitte erinnern Sie ${ownerName} rechtzeitig an diesen Termin.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Diese E-Mail wurde automatisch von Lebensordner gesendet.<br>
              Sie erhalten diese E-Mail, weil ${ownerName} Sie als vertrauenswürdige Person hinzugefügt hat.
            </p>
          </body>
          </html>
        `,
      })
    } catch (emailError) {
      console.error('Error sending watcher notification email:', emailError)
      // Continue anyway
    }

    return NextResponse.json({
      success: true,
      message: 'Benachrichtigung wurde gesendet',
    })
  } catch (error: any) {
    console.error('Notify watcher error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
