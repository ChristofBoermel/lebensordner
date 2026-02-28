import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// This endpoint should be called by a cron job daily
// Sends upgrade emails to FREE users who:
// - Registered 7+ days ago
// - Have uploaded at least 3 documents (are actively using the app)
// - Haven't received this email yet
// - Don't have an active subscription

// Validate required environment variables at module load
const CRON_SECRET = process.env['CRON_SECRET']
if (!CRON_SECRET) {
  console.error('[CRON] CRITICAL: CRON_SECRET not configured')
}

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!
)

const getResend = () => new Resend(process.env.RESEND_API_KEY)

interface EligibleUser {
  id: string
  email: string
  full_name: string | null
  created_at: string
  document_count: number
}

// Generate the upgrade email HTML
function generateUpgradeEmailHtml(name: string, documentCount: number): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wie gefällt Ihnen Lebensordner?</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f4; font-size: 18px; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #5d6b5d; padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                🌿 Lebensordner
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 24px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                ${name ? `Hallo ${name}` : 'Hallo'},
              </h2>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 18px; line-height: 1.7;">
                Sie nutzen Lebensordner jetzt seit einer Woche.
              </p>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 18px; line-height: 1.7;">
                Wir haben gesehen, dass Sie bereits <strong style="color: #5d6b5d;">${documentCount} Dokumente</strong> hochgeladen haben – großartig!
              </p>

              <p style="margin: 0 0 24px 0; color: #374151; font-size: 18px; line-height: 1.7;">
                Viele unserer Nutzer schalten nach kurzer Zeit Premium frei, um:
              </p>

              <!-- Benefits List -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #f0fdf4; border-radius: 8px; margin-bottom: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="32" style="vertical-align: top; padding-top: 2px;">
                          <span style="color: #16a34a; font-size: 20px;">✓</span>
                        </td>
                        <td style="color: #166534; font-size: 17px;">
                          <strong>Unbegrenzt Dokumente</strong> zu sichern
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td height="8"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #f0fdf4; border-radius: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="32" style="vertical-align: top; padding-top: 2px;">
                          <span style="color: #16a34a; font-size: 20px;">✓</span>
                        </td>
                        <td style="color: #166534; font-size: 17px;">
                          <strong>Automatische Erinnerungen</strong> vor Ablaufdaten zu erhalten
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td height="8"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #f0fdf4; border-radius: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="32" style="vertical-align: top; padding-top: 2px;">
                          <span style="color: #16a34a; font-size: 20px;">✓</span>
                        </td>
                        <td style="color: #166534; font-size: 17px;">
                          Ihre <strong>Familie per SMS</strong> im Notfall zu erreichen
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/abo" style="display: inline-block; background-color: #5d6b5d; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 18px; font-weight: 600;">
                      30 Tage kostenlos testen
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
                Sie können jederzeit kündigen – keine versteckten Kosten.
              </p>

              <p style="margin: 0; color: #374151; font-size: 18px; line-height: 1.7;">
                Viele Grüße<br>
                <strong>Ihr Lebensordner-Team</strong>
              </p>
            </td>
          </tr>

          <!-- PS Section -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; color: #92400e; font-size: 16px;">
                      <strong>PS:</strong> Sie können natürlich auch kostenlos weiter nutzen. Wir freuen uns, dass Sie dabei sind!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f4; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                Diese E-Mail wurde automatisch versendet.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                © ${new Date().getFullYear()} Lebensordner · <a href="${appUrl}/datenschutz" style="color: #9ca3af;">Datenschutz</a> · <a href="${appUrl}/impressum" style="color: #9ca3af;">Impressum</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export async function GET(request: Request) {
  // Fail-closed: CRON_SECRET must be set
  if (!CRON_SECRET) {
    console.error('[CRON] Request rejected: CRON_SECRET is not configured')
    return NextResponse.json(
      { error: 'Cron endpoint not configured' },
      { status: 500 }
    )
  }

  // Check authorization: either Bearer token or Vercel cron header
  const authHeader = request.headers.get('authorization')
  const vercelCronHeader = request.headers.get('x-vercel-cron')

  const isAuthorizedByBearer = authHeader === `Bearer ${CRON_SECRET}`
  const isAuthorizedByVercel = vercelCronHeader === '1'

  if (!isAuthorizedByBearer && !isAuthorizedByVercel) {
    console.warn('[CRON] Unauthorized request attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const resend = getResend()
  const results = {
    checked: 0,
    sent: 0,
    errors: [] as string[],
  }

  try {
    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    // Find eligible users:
    // - Created at least 7 days ago
    // - No subscription (free tier)
    // - Haven't received the 7-day email yet
    const { data: eligibleProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .lte('created_at', sevenDaysAgoISO)
      .is('upgrade_email_7d_sent_at', null)
      .or('subscription_status.is.null,subscription_status.eq.canceled')

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return NextResponse.json({
        error: 'Failed to fetch profiles',
        details: profileError.message,
      }, { status: 500 })
    }

    if (!eligibleProfiles || eligibleProfiles.length === 0) {
      return NextResponse.json({
        message: 'No eligible users found',
        results,
      })
    }

    // For each eligible profile, check document count
    for (const profile of eligibleProfiles) {
      results.checked++

      try {
        // Count documents for this user
        const { count: documentCount, error: countError } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)

        if (countError) {
          results.errors.push(`Failed to count documents for ${profile.email}: ${countError.message}`)
          continue
        }

        // Only send if user has at least 3 documents (actively using)
        if (!documentCount || documentCount < 3) {
          continue
        }

        // Send the email
        const { error: emailError } = await resend.emails.send({
          from: 'Lebensordner <noreply@lebensordner.org>',
          to: profile.email,
          subject: `${profile.full_name || 'Hallo'}, wie gefällt Ihnen Lebensordner?`,
          html: generateUpgradeEmailHtml(profile.full_name || '', documentCount),
        })

        if (emailError) {
          results.errors.push(`Failed to send email to ${profile.email}: ${emailError.message}`)
          continue
        }

        // Mark email as sent
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ upgrade_email_7d_sent_at: new Date().toISOString() })
          .eq('id', profile.id)

        if (updateError) {
          results.errors.push(`Failed to update profile ${profile.email}: ${updateError.message}`)
          continue
        }

        results.sent++
        console.log(`Sent 7-day upgrade email to ${profile.email} (${documentCount} documents)`)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`Error processing ${profile.email}: ${errorMessage}`)
      }
    }

    return NextResponse.json({
      message: 'Upgrade email job completed',
      results,
    })

  } catch (error) {
    console.error('Upgrade email cron error:', error)
    return NextResponse.json({
      error: 'Failed to process upgrade emails',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request)
}
