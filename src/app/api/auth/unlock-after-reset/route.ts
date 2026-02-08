import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { unlockAccount, resetFailureCount } from '@/lib/security/auth-lockout'
import { logSecurityEvent } from '@/lib/security/audit-log'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Require proof of a valid password-reset session before unlocking.
    // After completing a password reset, Supabase grants the user a session.
    // We read that session from the request cookies and verify the email matches.
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Valid password-reset session required' },
        { status: 401 }
      )
    }

    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Session email does not match request' },
        { status: 403 }
      )
    }

    // Unlock account and reset failure count
    await Promise.all([
      unlockAccount(email),
      resetFailureCount(email),
    ])

    await logSecurityEvent({
      event_type: 'account_unlocked',
      user_id: user.id,
      event_data: { email },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AUTH] Unlock error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
