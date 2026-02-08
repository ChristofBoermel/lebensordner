import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { getTierFromSubscription, getDownloadLinkType, canCreateDownloadLinks } from '@/lib/subscription-tiers'
import { logSecurityEvent, EVENT_DOWNLOAD_LINK_CREATED } from '@/lib/security/audit-log'
import { checkRateLimit, incrementRateLimit, RATE_LIMIT_DOWNLOAD_LINK } from '@/lib/security/rate-limit'

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

    // Get user profile for the email and subscription info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, subscription_status, stripe_price_id')
      .eq('id', user.id)
      .single()

    const senderName = profile?.full_name || profile?.email || 'Unbekannt'

    // Determine user's tier and link type
    const userTier = getTierFromSubscription(
      profile?.subscription_status || null,
      profile?.stripe_price_id || null
    )

    // Check if user can create download links
    if (!canCreateDownloadLinks(userTier)) {
      return NextResponse.json(
        { error: 'Download-Links sind nur mit einem kostenpflichtigen Abo verfügbar. Bitte upgraden Sie Ihr Konto.' },
        { status: 403 }
      )
    }

    // Extract client IP
    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    // IP-based rate limiting
    const ipRateLimitConfig = {
      identifier: `download_link_ip:${clientIp}`,
      endpoint: '/api/download-link/create',
      ...RATE_LIMIT_DOWNLOAD_LINK,
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
      identifier: `download_link:${user.id}`,
      endpoint: '/api/download-link/create',
      ...RATE_LIMIT_DOWNLOAD_LINK,
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

    // Get link type based on tier
    const linkType = getDownloadLinkType(userTier)!

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
        link_type: linkType,
      })

    if (insertError) {
      console.error('Error creating download token:', insertError)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Download-Links' },
        { status: 500 }
      )
    }

    // Log security event for download link creation
    logSecurityEvent({
      user_id: user.id,
      event_type: EVENT_DOWNLOAD_LINK_CREATED,
      event_data: {
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        link_type: linkType,
        expires_at: expiresAt.toISOString(),
      },
      request: request as NextRequest,
    })

    // Create the download URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'
    const downloadUrl = `${baseUrl}/herunterladen/${token}`

    // Send email to recipient with tier-specific content
    const isViewOnly = linkType === 'view'
    const emailSubject = isViewOnly
      ? `${senderName} teilt Dokumente mit Ihnen (Ansicht)`
      : `${senderName} teilt Dokumente zum Download mit Ihnen`
    const buttonText = isViewOnly ? 'Dokumente ansehen' : 'Dokumente herunterladen'
    const actionDescription = isViewOnly
      ? 'Klicken Sie auf den folgenden Link, um alle Dokumente im Browser anzusehen:'
      : 'Klicken Sie auf den folgenden Link, um alle Dokumente als ZIP-Datei herunterzuladen:'
    const tierInfo = isViewOnly
      ? `<div style="background-color: #dbeafe; border: 1px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #1e40af;">
            <strong>Hinweis:</strong> Sie können die Dokumente ansehen, aber nicht herunterladen. Der Besitzer hat ein Basis-Abo.
          </p>
        </div>`
      : `<div style="background-color: #f3e8ff; border: 1px solid #a855f7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #7c3aed;">
            Mit dem Premium-Abo des Besitzers können Sie alle Dokumente als ZIP-Datei herunterladen.
          </p>
        </div>`
    const usageNote = isViewOnly
      ? 'Dieser Link ist <strong>12 Stunden</strong> gültig und kann mehrfach zum Ansehen verwendet werden.'
      : 'Dieser Link ist <strong>12 Stunden</strong> gültig und kann nur einmal verwendet werden.'

    try {
      await getResend().emails.send({
        from: 'Lebensordner <noreply@lebensordner.org>',
        to: recipientEmail,
        subject: emailSubject,
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
              ${actionDescription}
            </p>

            <div style="margin: 24px 0; text-align: center;">
              <a href="${downloadUrl}"
                 style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500;">
                ${buttonText}
              </a>
            </div>

            ${tierInfo}

            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 0; color: #92400e; font-weight: 500;">
                Wichtiger Hinweis:
              </p>
              <p style="margin: 8px 0 0 0; color: #92400e;">
                ${usageNote}
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

    await incrementRateLimit(rateLimitConfig)
    await incrementRateLimit(ipRateLimitConfig)

    return NextResponse.json({
      success: true,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
      linkType,
      message: linkType === 'view'
        ? 'Ansichts-Link wurde erstellt und per E-Mail gesendet'
        : 'Download-Link wurde erstellt und per E-Mail gesendet',
    })
  } catch (error: any) {
    console.error('Create download link error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
