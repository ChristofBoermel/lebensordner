import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as OTPAuth from 'otpauth'
import { decrypt, getEncryptionKey, type EncryptedData } from '@/lib/security/encryption'
import { logSecurityEvent, EVENT_TWO_FACTOR_VERIFIED } from '@/lib/security/audit-log'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import { consumePendingAuthChallenge, getPendingAuthChallenge } from '@/lib/security/pending-auth'

const getSupabaseAdmin = () => {
  return createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { challengeId, token } = await request.json()

    if (!challengeId || !token) {
      return NextResponse.json({ error: 'Challenge und Token erforderlich' }, { status: 400 })
    }

    let pendingAuth
    try {
      pendingAuth = await getPendingAuthChallenge(challengeId)
    } catch {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }

    if (!pendingAuth) {
      return NextResponse.json({ error: 'Challenge ungültig oder abgelaufen' }, { status: 400 })
    }

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    if (pendingAuth.clientIp !== clientIp || pendingAuth.userAgent !== userAgent) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '2FA challenge rejected due to context mismatch',
        endpoint: '/api/auth/2fa/verify',
        metadata: { userId: pendingAuth.userId },
      })
      return NextResponse.json({ error: 'Challenge-Kontext ungültig' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled, email, two_factor_secret_encrypted')
      .eq('id', pendingAuth.userId)
      .single()

    if (profileError) {
      emitStructuredError({
        error_type: 'auth',
        error_message: `Profile fetch error: ${profileError.message}`,
        endpoint: '/api/auth/2fa/verify',
      })
      return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 400 })
    }

    if (!profile?.two_factor_enabled || !profile?.two_factor_secret) {
      return NextResponse.json({ error: '2FA nicht aktiviert' }, { status: 400 })
    }

    let secretBase32: string
    if (profile.two_factor_secret_encrypted) {
      try {
        const key = getEncryptionKey()
        const parsed: EncryptedData = JSON.parse(profile.two_factor_secret)
        secretBase32 = decrypt(parsed, key)
      } catch (error) {
        emitStructuredError({
          error_type: 'auth',
          error_message: `Failed to decrypt two_factor_secret: ${error instanceof Error ? error.message : String(error)}`,
          endpoint: '/api/auth/2fa/verify',
          stack: error instanceof Error ? error.stack : undefined,
        })
        return NextResponse.json({ error: 'Fehler beim Entschlüsseln des 2FA-Secrets' }, { status: 500 })
      }
    } else {
      secretBase32 = profile.two_factor_secret
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'Lebensordner',
      label: profile.email || pendingAuth.email || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    })

    const delta = totp.validate({ token, window: 2 })
    if (delta === null) {
      return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
    }

    let consumedChallenge
    try {
      consumedChallenge = await consumePendingAuthChallenge(challengeId)
    } catch {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }

    if (!consumedChallenge) {
      return NextResponse.json({ error: 'Challenge ungültig oder abgelaufen' }, { status: 400 })
    }

    await logSecurityEvent({
      user_id: pendingAuth.userId,
      event_type: EVENT_TWO_FACTOR_VERIFIED,
      event_data: { method: 'totp' },
      request,
    })

    return NextResponse.json({
      success: true,
      access_token: consumedChallenge.accessToken,
      refresh_token: consumedChallenge.refreshToken,
      rememberMe: consumedChallenge.rememberMe,
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'auth',
      error_message: `2FA verify error: ${error?.message ?? String(error)}`,
      endpoint: '/api/auth/2fa/verify',
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: error.message || 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    )
  }
}
