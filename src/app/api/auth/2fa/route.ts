import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as OTPAuth from 'otpauth'
import { encrypt, decrypt, getEncryptionKey, type EncryptedData } from '@/lib/security/encryption'
import { checkRateLimit, incrementRateLimit, RATE_LIMIT_2FA } from '@/lib/security/rate-limit'
import { logSecurityEvent, EVENT_TWO_FACTOR_ENABLED, EVENT_TWO_FACTOR_DISABLED } from '@/lib/security/audit-log'

// Generate new 2FA secret
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

    // IP-based rate limiting
    const ipRateLimitConfig = {
      identifier: `2fa_ip:${clientIp}`,
      endpoint: '/api/auth/2fa',
      ...RATE_LIMIT_2FA,
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
      identifier: `2fa:${user.id}`,
      endpoint: '/api/auth/2fa',
      ...RATE_LIMIT_2FA,
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

    const { action, token } = await request.json()

    if (action === 'generate') {
      // Generate new secret
      const secret = new OTPAuth.Secret({ size: 20 })
      
      const totp = new OTPAuth.TOTP({
        issuer: 'Lebensordner',
        label: user.email || 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      })

      const otpauthUrl = totp.toString()

      // Encrypt and store secret temporarily (not enabled yet)
      const key = getEncryptionKey()
      const encrypted = encrypt(secret.base32, key)

      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_secret: JSON.stringify(encrypted),
          two_factor_secret_encrypted: true,
          two_factor_enabled: false,
        })
        .eq('id', user.id)

      if (error) throw error

      await incrementRateLimit(rateLimitConfig)
      await incrementRateLimit(ipRateLimitConfig)

      return NextResponse.json({
        secret: secret.base32,
        otpauthUrl,
      })
    }

    if (action === 'verify') {
      // Get stored secret
      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_secret, two_factor_secret_encrypted')
        .eq('id', user.id)
        .single()

      if (!profile?.two_factor_secret) {
        return NextResponse.json({ error: 'Kein 2FA-Secret gefunden' }, { status: 400 })
      }

      let secretBase32: string
      if (profile.two_factor_secret_encrypted) {
        try {
          const key = getEncryptionKey()
          const parsed: EncryptedData = JSON.parse(profile.two_factor_secret)
          secretBase32 = decrypt(parsed, key)
        } catch (e) {
          console.error('Failed to decrypt two_factor_secret:', e)
          return NextResponse.json({ error: 'Fehler beim Entschlüsseln des 2FA-Secrets' }, { status: 500 })
        }
      } else {
        secretBase32 = profile.two_factor_secret
      }

      // Verify token
      const totp = new OTPAuth.TOTP({
        issuer: 'Lebensordner',
        label: user.email || 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
      })

      const isValid = totp.validate({ token, window: 1 }) !== null

      if (!isValid) {
        return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
      }

      // Enable 2FA
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: true,
        })
        .eq('id', user.id)

      if (error) throw error

      logSecurityEvent({
        user_id: user.id,
        event_type: EVENT_TWO_FACTOR_ENABLED,
        event_data: { method: 'totp' },
        request: request as any,
      })

      await incrementRateLimit(rateLimitConfig)
      await incrementRateLimit(ipRateLimitConfig)

      return NextResponse.json({ success: true })
    }

    if (action === 'disable') {
      // Get stored secret
      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_secret, two_factor_enabled, two_factor_secret_encrypted')
        .eq('id', user.id)
        .single()

      if (!profile?.two_factor_enabled) {
        return NextResponse.json({ error: '2FA ist nicht aktiviert' }, { status: 400 })
      }

      let secretBase32: string
      if (profile.two_factor_secret_encrypted) {
        try {
          const key = getEncryptionKey()
          const parsed: EncryptedData = JSON.parse(profile.two_factor_secret)
          secretBase32 = decrypt(parsed, key)
        } catch (e) {
          console.error('Failed to decrypt two_factor_secret:', e)
          return NextResponse.json({ error: 'Fehler beim Entschlüsseln des 2FA-Secrets' }, { status: 500 })
        }
      } else {
        secretBase32 = profile.two_factor_secret
      }

      // Verify token before disabling
      const totp = new OTPAuth.TOTP({
        issuer: 'Lebensordner',
        label: user.email || 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
      })

      const isValid = totp.validate({ token, window: 1 }) !== null

      if (!isValid) {
        return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
      }

      // Disable 2FA
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_secret_encrypted: false,
        })
        .eq('id', user.id)

      if (error) throw error

      logSecurityEvent({
        user_id: user.id,
        event_type: EVENT_TWO_FACTOR_DISABLED,
        event_data: { method: 'totp' },
        request: request as any,
      })

      await incrementRateLimit(rateLimitConfig)
      await incrementRateLimit(ipRateLimitConfig)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  } catch (error: any) {
    console.error('2FA error:', error)
    return NextResponse.json(
      { error: error.message || 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    )
  }
}
