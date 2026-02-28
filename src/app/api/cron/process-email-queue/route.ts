import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendEmailWithTimeout,
  updateEmailStatus,
  calculateNextRetryTime,
  MAX_RETRY_ATTEMPTS,
  DEFAULT_EMAIL_TIMEOUT_MS,
} from '@/lib/email/resend-service'
import { getTierFromSubscription, allowsFamilyDownloads } from '@/lib/subscription-tiers'

// This endpoint should be called by a cron job
// Recommended: Call every 5 minutes

// Validate required environment variables at module load
const CRON_SECRET = process.env.CRON_SECRET
if (!CRON_SECRET) {
  console.error('[CRON] CRITICAL: CRON_SECRET environment variable is not set. Cron endpoint will reject all requests.')
}

const getSupabaseAdmin = () =>
  createClient(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!
  )

interface QueueItem {
  id: string
  trusted_person_id: string
  retry_count: number
  last_error: string | null
  next_retry_at: string
  status: string
}

interface TrustedPerson {
  id: string
  user_id: string
  name: string
  email: string
  relationship: string
  invitation_token: string
}

interface Profile {
  full_name: string | null
  email: string
  subscription_status: string | null
  stripe_price_id: string | null
}

export async function GET(request: Request) {
  // Verify authorization - require valid CRON_SECRET or Vercel cron header
  const authHeader = request.headers.get('authorization')
  const vercelCronHeader = request.headers.get('x-vercel-cron')

  // CRON_SECRET must be set - reject all requests if not configured
  if (!CRON_SECRET) {
    console.error('[CRON] Request rejected: CRON_SECRET is not configured')
    return NextResponse.json(
      { error: 'Cron endpoint not configured' },
      { status: 500 }
    )
  }

  // Check authorization: either Bearer token or Vercel cron header
  const isAuthorizedByBearer = authHeader === `Bearer ${CRON_SECRET}`
  const isAuthorizedByVercel = vercelCronHeader === '1'

  if (!isAuthorizedByBearer && !isAuthorizedByVercel) {
    console.warn('[CRON] Unauthorized request attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    permanently_failed: 0,
    errors: [] as string[],
  }

  try {
    const now = new Date().toISOString()

    // Fetch pending queue items that are ready for retry
    const { data: queueItems, error: fetchError } = await supabase
      .from('email_retry_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', now)
      .limit(50)

    if (fetchError) {
      throw new Error(`Failed to fetch queue items: ${fetchError.message}`)
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending items in queue',
        timestamp: new Date().toISOString(),
        ...results,
      })
    }

    for (const item of queueItems as QueueItem[]) {
      results.processed++

      // Mark as processing
      await supabase
        .from('email_retry_queue')
        .update({ status: 'processing' })
        .eq('id', item.id)

      try {
        // Fetch trusted person details
        const { data: trustedPerson, error: tpError } = await supabase
          .from('trusted_persons')
          .select('id, user_id, name, email, relationship, invitation_token')
          .eq('id', item.trusted_person_id)
          .single()

        if (tpError || !trustedPerson) {
          throw new Error(`Trusted person not found: ${item.trusted_person_id}`)
        }

        // Fetch owner profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email, subscription_status, stripe_price_id')
          .eq('id', (trustedPerson as TrustedPerson).user_id)
          .single()

        if (profileError || !profile) {
          throw new Error(`Owner profile not found for user: ${(trustedPerson as TrustedPerson).user_id}`)
        }

        const tp = trustedPerson as TrustedPerson
        const ownerProfile = profile as Profile
        const ownerName = ownerProfile.full_name || 'Jemand'
        const ownerTier = getTierFromSubscription(
          ownerProfile.subscription_status,
          ownerProfile.stripe_price_id
        )
        const canDownload = allowsFamilyDownloads(ownerTier)

        const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lebensordner.org'}/einladung/${tp.invitation_token}`

        // Attempt to send email
        const emailResult = await sendEmailWithTimeout(
          {
            from: 'Lebensordner <einladung@lebensordner.org>',
            to: tp.email,
            subject: `${ownerName} hat Sie als Vertrauensperson eingeladen`,
            html: generateRetryInvitationEmail({
              trustedPersonName: tp.name,
              ownerName,
              invitationLink,
              relationship: tp.relationship || 'Vertrauensperson',
              ownerTier: ownerTier.id,
              canDownload,
            }),
          },
          DEFAULT_EMAIL_TIMEOUT_MS
        )

        if (emailResult.success) {
          // Mark queue item as completed
          await supabase
            .from('email_retry_queue')
            .update({ status: 'completed' })
            .eq('id', item.id)

          // Update trusted person email status
          await updateEmailStatus(item.trusted_person_id, 'sent', {
            email_sent_at: new Date().toISOString(),
            email_error: null,
          })

          results.succeeded++

          console.log(
            JSON.stringify({
              event: 'email_retry_succeeded',
              queue_id: item.id,
              trusted_person_id: item.trusted_person_id,
              retry_count: item.retry_count,
              timestamp: new Date().toISOString(),
            })
          )
        } else {
          // Email failed
          const newRetryCount = item.retry_count + 1

          if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
            // Mark as permanently failed
            await supabase
              .from('email_retry_queue')
              .update({
                status: 'failed',
                last_error: emailResult.error,
                retry_count: newRetryCount,
              })
              .eq('id', item.id)

            await updateEmailStatus(item.trusted_person_id, 'failed', {
              email_error: `Permanently failed after ${MAX_RETRY_ATTEMPTS} attempts: ${emailResult.error}`,
              email_retry_count: newRetryCount,
            })

            results.permanently_failed++

            console.log(
              JSON.stringify({
                event: 'email_retry_permanently_failed',
                queue_id: item.id,
                trusted_person_id: item.trusted_person_id,
                retry_count: newRetryCount,
                error: emailResult.error,
                timestamp: new Date().toISOString(),
              })
            )
          } else {
            // Schedule next retry
            const nextRetryAt = calculateNextRetryTime(newRetryCount)

            await supabase
              .from('email_retry_queue')
              .update({
                status: 'pending',
                last_error: emailResult.error,
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt,
              })
              .eq('id', item.id)

            await updateEmailStatus(item.trusted_person_id, 'pending', {
              email_error: emailResult.error,
              email_retry_count: newRetryCount,
            })

            results.failed++

            console.log(
              JSON.stringify({
                event: 'email_retry_scheduled',
                queue_id: item.id,
                trusted_person_id: item.trusted_person_id,
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt,
                error: emailResult.error,
                timestamp: new Date().toISOString(),
              })
            )
          }
        }
      } catch (itemError: any) {
        // Mark queue item for retry on unexpected errors
        await supabase
          .from('email_retry_queue')
          .update({
            status: 'pending',
            last_error: itemError.message,
          })
          .eq('id', item.id)

        results.errors.push(`Error processing ${item.id}: ${itemError.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error: any) {
    console.error('Email queue processing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        ...results,
      },
      { status: 500 }
    )
  }
}

interface InvitationEmailData {
  trustedPersonName: string
  ownerName: string
  invitationLink: string
  relationship: string
  ownerTier: 'free' | 'basic' | 'premium'
  canDownload: boolean
}

function generateRetryInvitationEmail(data: InvitationEmailData): string {
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
          <li style="margin-bottom: 8px;">${data.canDownload
            ? 'Sie können Dokumente ansehen und herunterladen'
            : data.ownerTier === 'basic'
              ? 'Sie können Dokumente ansehen (Download mit Premium)'
              : `Zugriff wird verfügbar, sobald ${data.ownerName} ein Abo abschließt`}</li>
          <li>Sie können jederzeit den Zugriff beenden</li>
        </ul>
      </div>

      ${data.canDownload ? `
      <div style="background-color: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 20px;">✅</span>
          <div>
            <h4 style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">Voller Zugriff</h4>
            <p style="color: #166534; font-size: 13px; margin: 0;">Sie können alle Dokumente von ${data.ownerName} ansehen und herunterladen.</p>
          </div>
        </div>
      </div>
      ` : data.ownerTier === 'basic' ? `
      <div style="background-color: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 20px;">👁️</span>
          <div>
            <h4 style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">Ansichts-Zugriff</h4>
            <p style="color: #1e40af; font-size: 13px; margin: 0;">Sie können alle Dokumente von ${data.ownerName} ansehen. Downloads sind mit einem Premium-Abo verfügbar.</p>
          </div>
        </div>
      </div>
      ` : `
      <div style="background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 20px;">ℹ️</span>
          <div>
            <h4 style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">Eingeschränkter Zugriff</h4>
            <p style="color: #374151; font-size: 13px; margin: 0;">${data.ownerName} benötigt ein kostenpflichtiges Abo, um Ihnen vollen Zugriff zu gewähren.</p>
          </div>
        </div>
      </div>
      `}

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
