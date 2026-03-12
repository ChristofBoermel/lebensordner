import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createTrustedAccessOtpCookie,
  hashTrustedAccessOtp,
  readCookieValueFromHeader,
  readTrustedAccessPendingCookie,
  TRUSTED_ACCESS_OTP_COOKIE,
  TRUSTED_ACCESS_PENDING_COOKIE,
} from '@/lib/security/trusted-access'

const getSupabaseAdmin = () =>
  createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function POST(request: Request) {
  try {
    const pendingCookie = readTrustedAccessPendingCookie(
      readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_PENDING_COOKIE)
    )

    if (!pendingCookie) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/trusted-access/invitations/otp/verify'
    )

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : ''
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()
    const { data: invitation, error: invitationError } = await adminClient
      .from('trusted_access_invitations')
      .select(`
        id,
        trusted_persons:trusted_person_id (
          id,
          email,
          linked_user_id,
          invitation_status,
          is_active
        )
      `)
      .eq('id', pendingCookie.invitationId)
      .maybeSingle()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    const trustedPerson = Array.isArray(invitation.trusted_persons)
      ? invitation.trusted_persons[0]
      : invitation.trusted_persons

    const wrongAccount =
      !trustedPerson ||
      trustedPerson.linked_user_id !== user.id ||
      trustedPerson.email.toLowerCase().trim() !== (user.email?.toLowerCase().trim() ?? '')

    if (wrongAccount) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access OTP Verify API] Wrong account blocked from OTP verify',
        endpoint: '/api/trusted-access/invitations/otp/verify',
        metadata: {
          invitationId: pendingCookie.invitationId,
          userId: user.id,
        },
      })
      return NextResponse.json({ error: 'Wrong account' }, { status: 403 })
    }

    const { data: challenges, error: challengeError } = await adminClient
      .from('trusted_access_otp_challenges')
      .select('id, code_hash, expires_at, attempt_count, max_attempts, consumed_at')
      .eq('invitation_id', invitation.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const challenge = challenges?.[0]
    if (challengeError || !challenge || challenge.consumed_at) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 410 })
    }

    const expiresAtMs = new Date(challenge.expires_at).getTime()
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 410 })
    }

    if (challenge.attempt_count >= challenge.max_attempts) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access OTP Verify API] OTP attempts exhausted',
        endpoint: '/api/trusted-access/invitations/otp/verify',
        metadata: {
          invitationId: invitation.id,
          trustedPersonId: trustedPerson.id,
        },
      })
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
    }

    if (challenge.code_hash !== hashTrustedAccessOtp(otp)) {
      await adminClient
        .from('trusted_access_otp_challenges')
        .update({ attempt_count: challenge.attempt_count + 1 })
        .eq('id', challenge.id)

      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access OTP Verify API] Invalid OTP submitted',
        endpoint: '/api/trusted-access/invitations/otp/verify',
        metadata: {
          invitationId: invitation.id,
          trustedPersonId: trustedPerson.id,
          attemptCount: challenge.attempt_count + 1,
        },
      })

      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    await adminClient
      .from('trusted_access_otp_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', challenge.id)

    const response = NextResponse.json({ success: true })
    response.cookies.set({
      name: TRUSTED_ACCESS_OTP_COOKIE,
      value: createTrustedAccessOtpCookie({
        invitationId: invitation.id,
        userId: user.id,
      }),
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 10 * 60,
    })
    return response
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Trusted Access OTP Verify API] Unexpected error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-access/invitations/otp/verify',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
