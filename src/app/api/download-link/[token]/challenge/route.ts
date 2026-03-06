import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashDownloadToken } from '@/lib/security/download-token'
import { buildRecipientChallengeSetCookie } from '@/lib/security/download-link-recipient-challenge'
import { checkRateLimit } from '@/lib/security/rate-limit'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface VerifyRecipientRequest {
  recipientEmail?: string
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const token = params.token
    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
    }

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'
    const ipRateLimit = await checkRateLimit({
      identifier: `download_link_challenge_ip:${clientIp}`,
      endpoint: '/api/download-link/[token]/challenge',
      maxRequests: 8,
      windowMs: 60 * 60 * 1000,
      failMode: 'closed',
    })
    if (ipRateLimit.available === false) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }
    if (!ipRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil((ipRateLimit.resetAt.getTime() - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Zu viele Versuche. Bitte versuchen Sie es später erneut.', retryAfterSeconds },
        { status: 429 }
      )
    }

    const tokenRateLimit = await checkRateLimit({
      identifier: `download_link_challenge_token:${token}`,
      endpoint: '/api/download-link/[token]/challenge',
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      failMode: 'closed',
    })
    if (tokenRateLimit.available === false) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }
    if (!tokenRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil((tokenRateLimit.resetAt.getTime() - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Zu viele Versuche. Bitte versuchen Sie es später erneut.', retryAfterSeconds },
        { status: 429 }
      )
    }

    const { recipientEmail } = await request.json() as VerifyRecipientRequest
    const normalizedEmail = recipientEmail?.toLowerCase().trim() ?? ''
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Empfänger-E-Mail ist erforderlich' }, { status: 400 })
    }

    const tokenHash = hashDownloadToken(token)
    const tokenHashPrefix = tokenHash.slice(0, 12)
    const adminClient = getSupabaseAdmin()
    const { data: downloadToken, error } = await adminClient
      .from('download_tokens')
      .select('recipient_email, expires_at')
      .eq('token_hash', tokenHash)
      .single()

    if (error || !downloadToken) {
      return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
    }

    if (new Date(downloadToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Dieser Link ist abgelaufen' }, { status: 410 })
    }

    const expectedEmail = downloadToken.recipient_email?.toLowerCase().trim()
    if (!expectedEmail || expectedEmail !== normalizedEmail) {
      return NextResponse.json({ error: 'Empfänger-E-Mail stimmt nicht überein' }, { status: 403 })
    }

    const response = NextResponse.json({ success: true })
    response.headers.set(
      'Set-Cookie',
      buildRecipientChallengeSetCookie(tokenHashPrefix, expectedEmail)
    )
    return response
  } catch {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
