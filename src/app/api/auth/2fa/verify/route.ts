import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as OTPAuth from 'otpauth'
import { decrypt, getEncryptionKey, type EncryptedData } from '@/lib/security/encryption'
import { logSecurityEvent, EVENT_TWO_FACTOR_VERIFIED } from '@/lib/security/audit-log'

// Use admin client to bypass RLS since user isn't authenticated yet
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Verify 2FA token during login
export async function POST(request: Request) {
  try {
    const { userId, token } = await request.json()

    console.log('2FA verify request:', { userId, tokenLength: token?.length })

    if (!userId || !token) {
      return NextResponse.json({ error: 'User ID und Token erforderlich' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get user's 2FA secret
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled, email, two_factor_secret_encrypted')
      .eq('id', userId)
      .single()

    console.log('Profile lookup result:', { 
      found: !!profile, 
      error: profileError?.message,
      has2FA: profile?.two_factor_enabled,
      hasSecret: !!profile?.two_factor_secret
    })

    if (profileError) {
      console.error('Profile fetch error:', profileError)
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
      label: profile.email || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    })

    const delta = totp.validate({ token, window: 2 }) // Increased window for time drift

    console.log('TOTP validation result:', { delta, isValid: delta !== null })

    if (delta === null) {
      return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
    }

    logSecurityEvent({
      user_id: userId,
      event_type: EVENT_TWO_FACTOR_VERIFIED,
      event_data: { method: 'totp' },
      request: request as any,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('2FA verify error:', error)
    return NextResponse.json(
      { error: error.message || 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    )
  }
}
