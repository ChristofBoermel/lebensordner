import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  readCookieValueFromHeader,
  readTrustedAccessOtpCookie,
  readTrustedAccessPendingCookie,
  TRUSTED_ACCESS_OTP_COOKIE,
  TRUSTED_ACCESS_PENDING_COOKIE,
} from '@/lib/security/trusted-access'

const getSupabaseAdmin = () =>
  createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET(request: Request) {
  try {
    const pendingCookie = readTrustedAccessPendingCookie(
      readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_PENDING_COOKIE)
    )

    if (!pendingCookie) {
      return NextResponse.json(
        {
          status: 'expired_invitation',
          userMessageKey: 'secure_access_invitation_expired',
        },
        { status: 410 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/trusted-access/invitations/pending'
    )

    const adminClient = getSupabaseAdmin()

    const { data: invitation, error: invitationError } = await adminClient
      .from('trusted_access_invitations')
      .select(`
        id,
        owner_id,
        trusted_person_id,
        status,
        expires_at,
        trusted_persons:trusted_person_id (
          id,
          email,
          linked_user_id,
          invitation_status,
          is_active
        ),
        profiles:owner_id (
          full_name,
          email
        )
      `)
      .eq('id', pendingCookie.invitationId)
      .maybeSingle()

    if (invitationError || !invitation) {
      return NextResponse.json(
        {
          status: 'expired_invitation',
          userMessageKey: 'secure_access_invitation_expired',
        },
        { status: 410 }
      )
    }

    const trustedPerson = Array.isArray(invitation.trusted_persons)
      ? invitation.trusted_persons[0]
      : invitation.trusted_persons
    const ownerProfile = Array.isArray(invitation.profiles)
      ? invitation.profiles[0]
      : invitation.profiles

    const expiresAtMs = new Date(invitation.expires_at).getTime()
    const invitationExpired = invitation.status !== 'pending' || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()
    if (
      invitationExpired ||
      !trustedPerson ||
      trustedPerson.invitation_status !== 'accepted' ||
      !trustedPerson.is_active
    ) {
      return NextResponse.json(
        {
          status: invitation.status === 'revoked' ? 'revoked' : 'expired_invitation',
          userMessageKey:
            invitation.status === 'revoked'
              ? 'secure_access_revoked'
              : 'secure_access_invitation_expired',
        },
        { status: 410 }
      )
    }

    const normalizedExpectedEmail = trustedPerson.email.toLowerCase().trim()
    const normalizedUserEmail = user?.email?.toLowerCase().trim() ?? ''
    const wrongAccount =
      !user ||
      trustedPerson.linked_user_id !== user.id ||
      normalizedUserEmail !== normalizedExpectedEmail

    const otpCookie = readTrustedAccessOtpCookie(
      readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_OTP_COOKIE)
    )

    return NextResponse.json({
      status: wrongAccount ? 'wrong_account' : 'setup_required',
      expectedEmail: trustedPerson.email,
      ownerName: ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner',
      invitationExpiresAt: invitation.expires_at,
      otpVerified: Boolean(otpCookie && otpCookie.invitationId === invitation.id && otpCookie.userId === user?.id),
      userMessageKey: wrongAccount ? 'secure_access_wrong_account' : 'secure_access_setup_required',
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Trusted Access Pending API] Unexpected error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-access/invitations/pending',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
