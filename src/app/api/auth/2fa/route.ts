import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as OTPAuth from 'otpauth'

// Generate new 2FA secret
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
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

      // Store secret temporarily (not enabled yet)
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_secret: secret.base32,
          two_factor_enabled: false,
        })
        .eq('id', user.id)

      if (error) throw error

      return NextResponse.json({
        secret: secret.base32,
        otpauthUrl,
      })
    }

    if (action === 'verify') {
      // Get stored secret
      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_secret')
        .eq('id', user.id)
        .single()

      if (!profile?.two_factor_secret) {
        return NextResponse.json({ error: 'Kein 2FA-Secret gefunden' }, { status: 400 })
      }

      // Verify token
      const totp = new OTPAuth.TOTP({
        issuer: 'Lebensordner',
        label: user.email || 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(profile.two_factor_secret),
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

      return NextResponse.json({ success: true })
    }

    if (action === 'disable') {
      // Get stored secret
      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_secret, two_factor_enabled')
        .eq('id', user.id)
        .single()

      if (!profile?.two_factor_enabled) {
        return NextResponse.json({ error: '2FA ist nicht aktiviert' }, { status: 400 })
      }

      // Verify token before disabling
      const totp = new OTPAuth.TOTP({
        issuer: 'Lebensordner',
        label: user.email || 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(profile.two_factor_secret),
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
        })
        .eq('id', user.id)

      if (error) throw error

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
