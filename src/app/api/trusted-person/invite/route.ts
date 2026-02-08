import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getTierFromSubscription, allowsFamilyDownloads, hasFeatureAccess, canPerformAction } from '@/lib/subscription-tiers'
import {
  sendEmailWithTimeout,
  addToRetryQueue,
  updateEmailStatus,
  DEFAULT_EMAIL_TIMEOUT_MS,
} from '@/lib/email/resend-service'
import { checkRateLimit, incrementRateLimit, RATE_LIMIT_INVITE } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    // Extract client IP
    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    // Get user's tier and validate invitation permission
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('subscription_status, stripe_price_id')
      .eq('id', user.id)
      .single()

    const userTier = getTierFromSubscription(
      userProfile?.subscription_status || null,
      userProfile?.stripe_price_id || null
    )

    // Check if user has familyDashboard feature (Basic or Premium)
    if (!hasFeatureAccess(userTier, 'familyDashboard')) {
      return NextResponse.json(
        { error: 'Vertrauenspersonen-Einladungen erfordern ein kostenpflichtiges Abo' },
        { status: 403 }
      )
    }

    // Get current trusted person count to validate limit
    const { count: trustedPersonCount, error: countError } = await supabase
      .from('trusted_persons')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError || trustedPersonCount === null || trustedPersonCount === undefined) {
      return NextResponse.json(
        { error: 'Limitprüfung fehlgeschlagen' },
        { status: 500 }
      )
    }

    if (!canPerformAction(userTier, 'addTrustedPerson', trustedPersonCount)) {
      return NextResponse.json(
        { error: `Sie können maximal ${userTier.limits.maxTrustedPersons} Vertrauenspersonen einladen` },
        { status: 403 }
      )
    }

    // IP-based rate limiting
    const ipRateLimitConfig = {
      identifier: `invite_ip:${clientIp}`,
      endpoint: '/api/trusted-person/invite',
      ...RATE_LIMIT_INVITE,
    }

    const ipRateLimit = await checkRateLimit(ipRateLimitConfig)
    if (!ipRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (ipRateLimit.resetAt.getTime() - Date.now()) / 1000
      )
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSeconds },
        { status: 429 }
      )
    }

    // Per-user rate limiting
    const rateLimitConfig = {
      identifier: `invite:${user.id}`,
      endpoint: '/api/trusted-person/invite',
      ...RATE_LIMIT_INVITE,
    }

    const rateLimit = await checkRateLimit(rateLimitConfig)
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (rateLimit.resetAt.getTime() - Date.now()) / 1000
      )
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSeconds },
        { status: 429 }
      )
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

    // Check for duplicate email (another trusted person with the same email for this user)
    // Use case-insensitive comparison with ilike
    const { data: existingPerson } = await supabase
      .from('trusted_persons')
      .select('id')
      .eq('user_id', user.id)
      .ilike('email', trustedPerson.email)
      .neq('id', trustedPersonId)
      .maybeSingle()

    if (existingPerson) {
      return NextResponse.json(
        { error: 'Diese E-Mail-Adresse wurde bereits als Vertrauensperson hinzugefügt' },
        { status: 400 }
      )
    }

    // Get owner profile with subscription info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, subscription_status, stripe_price_id')
      .eq('id', user.id)
      .single()

    // Determine owner's tier
    const ownerTier = getTierFromSubscription(
      profile?.subscription_status || null,
      profile?.stripe_price_id || null
    )
    const canDownload = allowsFamilyDownloads(ownerTier)

    // Generate invitation token if not exists
    const invitationToken = trustedPerson.invitation_token || crypto.randomUUID()

    const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.lebensordner.org'}/einladung/${invitationToken}`
    const ownerName = profile?.full_name || 'Jemand'

    // Update trusted person with invitation details and set email_status to 'sending'
    const { error: updateError } = await supabase
      .from('trusted_persons')
      .update({
        invitation_token: invitationToken,
        invitation_sent_at: new Date().toISOString(),
        invitation_status: 'sent',
        email_status: 'sending',
      })
      .eq('id', trustedPersonId)

    if (updateError) {
      throw updateError
    }

    // Send invitation email with timeout handling
    // Pass a callback to handle background completion when timeout fires but send is still in-flight
    const emailResult = await sendEmailWithTimeout(
      {
        from: 'Lebensordner <einladung@lebensordner.org>',
        to: trustedPerson.email,
        subject: `${ownerName} hat Sie als Vertrauensperson eingeladen`,
        html: generateInvitationEmail({
          trustedPersonName: trustedPerson.name,
          ownerName,
          invitationLink,
          relationship: trustedPerson.relationship || 'Vertrauensperson',
          ownerTier: ownerTier.id,
          canDownload,
        }),
      },
      DEFAULT_EMAIL_TIMEOUT_MS,
      // Callback when send completes after timeout (background completion)
      async (backgroundResult) => {
        if (backgroundResult.success) {
          // Send succeeded in background - update status to sent
          await updateEmailStatus(trustedPersonId, 'sent', {
            email_sent_at: new Date().toISOString(),
            email_error: null,
          })
          console.log(JSON.stringify({
            event: 'invitation_email_sent_background',
            trusted_person_id: trustedPersonId,
            email: trustedPerson.email,
            message_id: backgroundResult.messageId,
            timestamp: new Date().toISOString(),
          }))
        } else {
          // Send failed in background - now we can safely queue for retry
          const retryCount = trustedPerson.email_retry_count || 0
          await updateEmailStatus(trustedPersonId, 'failed', {
            email_error: backgroundResult.error,
            email_retry_count: retryCount + 1,
          })
          await addToRetryQueue(
            trustedPersonId,
            backgroundResult.error || 'Background email send failed',
            retryCount
          )
          console.log(JSON.stringify({
            event: 'invitation_email_failed_background',
            trusted_person_id: trustedPersonId,
            email: trustedPerson.email,
            error: backgroundResult.error,
            timestamp: new Date().toISOString(),
          }))
        }
      }
    )

    // Handle email result
    if (emailResult.success) {
      // Email sent successfully
      await updateEmailStatus(trustedPersonId, 'sent', {
        email_sent_at: new Date().toISOString(),
        email_error: null,
      })

      console.log(JSON.stringify({
        event: 'invitation_email_sent',
        trusted_person_id: trustedPersonId,
        email: trustedPerson.email,
        message_id: emailResult.messageId,
        timestamp: new Date().toISOString(),
      }))

      await incrementRateLimit(rateLimitConfig)
      await incrementRateLimit(ipRateLimitConfig)

      return NextResponse.json({
        success: true,
        invitationLink,
        message: 'Einladung wurde gesendet'
      })
    } else if (emailResult.timedOut) {
      // Email timed out - check if send is still in-flight
      if (emailResult.pendingInFlight) {
        // Send is still in-flight, don't queue retry to avoid duplicates
        // The background callback will handle the result when it completes
        console.log(JSON.stringify({
          event: 'invitation_email_timeout_pending',
          trusted_person_id: trustedPersonId,
          email: trustedPerson.email,
          timestamp: new Date().toISOString(),
        }))

        // Return success - the invitation link is valid, send is still in progress
        await incrementRateLimit(rateLimitConfig)
        await incrementRateLimit(ipRateLimitConfig)

        return NextResponse.json({
          success: true,
          invitationLink,
          message: 'Einladung wird gesendet'
        })
      }

      // Send was actually aborted/canceled - safe to queue for retry
      await updateEmailStatus(trustedPersonId, 'pending', {
        email_error: emailResult.error || 'Email sending timed out',
      })

      await addToRetryQueue(
        trustedPersonId,
        emailResult.error || 'Email sending timed out',
        0
      )

      console.log(JSON.stringify({
        event: 'invitation_email_timeout',
        trusted_person_id: trustedPersonId,
        email: trustedPerson.email,
        timestamp: new Date().toISOString(),
      }))

      // Return success - the invitation link is valid, email will be retried
      await incrementRateLimit(rateLimitConfig)
      await incrementRateLimit(ipRateLimitConfig)

      return NextResponse.json({
        success: true,
        invitationLink,
        message: 'Einladung wird gesendet'
      })
    } else {
      // Email failed - queue for retry
      const currentRetryCount = trustedPerson.email_retry_count || 0

      await updateEmailStatus(trustedPersonId, 'failed', {
        email_error: emailResult.error,
        email_retry_count: currentRetryCount + 1,
      })

      await addToRetryQueue(
        trustedPersonId,
        emailResult.error || 'Unknown email error',
        currentRetryCount
      )

      console.log(JSON.stringify({
        event: 'invitation_email_failed',
        trusted_person_id: trustedPersonId,
        email: trustedPerson.email,
        error: emailResult.error,
        retry_count: currentRetryCount + 1,
        timestamp: new Date().toISOString(),
      }))

      // Return success - the invitation link is valid, email will be retried
      await incrementRateLimit(rateLimitConfig)
      await incrementRateLimit(ipRateLimitConfig)

      return NextResponse.json({
        success: true,
        invitationLink,
        message: 'Einladung wird gesendet'
      })
    }
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
  ownerTier: 'free' | 'basic' | 'premium'
  canDownload: boolean
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
