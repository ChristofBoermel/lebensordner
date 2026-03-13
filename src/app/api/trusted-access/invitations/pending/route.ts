import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createTrustedAccessPendingCookie,
  hashTrustedAccessToken,
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

function setPendingInvitationCookie(
  response: NextResponse,
  invitation: {
    id: string
    owner_id: string
    trusted_person_id: string
  },
  expectedEmail: string
) {
  response.cookies.set({
    name: TRUSTED_ACCESS_PENDING_COOKIE,
    value: createTrustedAccessPendingCookie({
      invitationId: invitation.id,
      ownerId: invitation.owner_id,
      trustedPersonId: invitation.trusted_person_id,
      expectedEmail,
    }),
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 15 * 60,
  })
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')?.trim() ?? ''
    const pendingCookie = readTrustedAccessPendingCookie(
      readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_PENDING_COOKIE)
    )

    if (!pendingCookie && !token) {
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
    let invitationQuery = adminClient
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

    invitationQuery = pendingCookie
      ? invitationQuery.eq('id', pendingCookie.invitationId)
      : invitationQuery.eq('token_hash', hashTrustedAccessToken(token))

    const { data: invitation, error: invitationError } = await invitationQuery.maybeSingle()

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

    const response = NextResponse.json({
      status: wrongAccount ? 'wrong_account' : 'setup_required',
      expectedEmail: trustedPerson.email,
      ownerName: ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner',
      invitationExpiresAt: invitation.expires_at,
      otpVerified: Boolean(otpCookie && otpCookie.invitationId === invitation.id && otpCookie.userId === user?.id),
      userMessageKey: wrongAccount ? 'secure_access_wrong_account' : 'secure_access_setup_required',
    })

    if (!pendingCookie) {
      setPendingInvitationCookie(response, invitation, trustedPerson.email)
    }

    return response
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
