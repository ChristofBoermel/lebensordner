import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as OTPAuth from 'otpauth'

// Verify 2FA token during login
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { userId, token } = await request.json()

    if (!userId || !token) {
      return NextResponse.json({ error: 'User ID und Token erforderlich' }, { status: 400 })
    }

    // Get user's 2FA secret
    const { data: profile } = await supabase
      .from('profiles')
      .select('two_factor_secret, two_factor_enabled, email')
      .eq('id', userId)
      .single()

    if (!profile?.two_factor_enabled || !profile?.two_factor_secret) {
      return NextResponse.json({ error: '2FA nicht aktiviert' }, { status: 400 })
    }

    // Verify token
    const totp = new OTPAuth.TOTP({
      issuer: 'Lebensordner',
      label: profile.email || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(profile.two_factor_secret),
    })

    const isValid = totp.validate({ token, window: 1 }) !== null

    if (!isValid) {
      return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('2FA verify error:', error)
    return NextResponse.json(
      { error: error.message || 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    )
  }
}
