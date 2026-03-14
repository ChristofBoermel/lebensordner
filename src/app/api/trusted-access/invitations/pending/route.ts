import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import {
  createTrustedAccessPendingCookie,
  hashTrustedAccessToken,
  readCookieValueFromHeader,
  readTrustedAccessOtpCookie,
  readTrustedAccessPendingCookie,
  TRUSTED_ACCESS_OTP_COOKIE,
  TRUSTED_ACCESS_PENDING_COOKIE,
} from '@/lib/security/trusted-access'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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
    maxAge: 24 * 60 * 60,
  })
}


type PendingInvitationRecord = {
  id: string
  owner_id: string
  trusted_person_id: string
  status: string
  expires_at: string
  otp_verified_at: string | null
  trusted_persons: {
    id: string
    email: string
    linked_user_id: string | null
    invitation_status: string
    relationship_status: string
    is_active: boolean
  } | Array<{
    id: string
    email: string
    linked_user_id: string | null
    invitation_status: string
    relationship_status: string
    is_active: boolean
  }> | null
  profiles: {
    full_name: string | null
    email: string | null
  } | Array<{
    full_name: string | null
    email: string | null
  }> | null
}

function normalizeInvitationRelations(invitation: PendingInvitationRecord) {
  const trustedPerson = Array.isArray(invitation.trusted_persons)
    ? invitation.trusted_persons[0]
    : invitation.trusted_persons
  const ownerProfile = Array.isArray(invitation.profiles)
    ? invitation.profiles[0]
    : invitation.profiles

  return { trustedPerson, ownerProfile }
}

function isUsablePendingInvitation(invitation: PendingInvitationRecord | null) {
  if (!invitation) return false

  const { trustedPerson } = normalizeInvitationRelations(invitation)
  const expiresAtMs = new Date(invitation.expires_at).getTime()
  const invitationExpired =
    invitation.status !== 'pending' || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()

  return Boolean(
    !invitationExpired &&
      trustedPerson &&
      trustedPerson.invitation_status === 'accepted' &&
      trustedPerson.is_active &&
      trustedPerson.relationship_status !== 'revoked'
  )
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

    const adminClient = createServiceRoleSupabaseClient()

    async function loadInvitationBy(column: 'id' | 'token_hash', value: string) {
      return adminClient
        .from('trusted_access_invitations')
        .select(`
          id,
          owner_id,
          trusted_person_id,
          status,
          expires_at,
          otp_verified_at,
          trusted_persons:trusted_person_id (
            id,
            email,
            linked_user_id,
            invitation_status,
            relationship_status,
            is_active
          ),
          profiles:owner_id (
            full_name,
            email
          )
        `)
        .eq(column, value)
        .maybeSingle()
    }

    const tokenHash = token ? hashTrustedAccessToken(token) : ''
    const cookieResult = pendingCookie
      ? await loadInvitationBy('id', pendingCookie.invitationId)
      : { data: null, error: null }
    const tokenResult = tokenHash
      ? await loadInvitationBy('token_hash', tokenHash)
      : { data: null, error: null }

    const cookieInvitation = cookieResult.data as PendingInvitationRecord | null
    const tokenInvitation = tokenResult.data as PendingInvitationRecord | null
    const tokenHasUsableFallback = Boolean(tokenHash) && isUsablePendingInvitation(tokenInvitation)

    if ((cookieResult.error && !tokenHasUsableFallback) || (tokenResult.error && !cookieInvitation)) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Pending API] Failed to load pending invitation: ${cookieResult.error?.message ?? tokenResult.error?.message ?? 'unknown error'}`,
        endpoint: '/api/trusted-access/invitations/pending',
        metadata: {
          hasPendingCookie: Boolean(pendingCookie),
          hasToken: Boolean(token),
          cookieError: cookieResult.error?.message ?? null,
          tokenError: tokenResult.error?.message ?? null,
          tokenHasUsableFallback,
        },
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const invitation = isUsablePendingInvitation(cookieInvitation)
      ? cookieInvitation
      : isUsablePendingInvitation(tokenInvitation)
        ? tokenInvitation
        : cookieInvitation ?? tokenInvitation

    if (!invitation) {
      return NextResponse.json(
        {
          status: 'expired_invitation',
          userMessageKey: 'secure_access_invitation_expired',
        },
        { status: 410 }
      )
    }

    const { trustedPerson, ownerProfile } = normalizeInvitationRelations(invitation)

    const expiresAtMs = new Date(invitation.expires_at).getTime()
    const invitationExpired = invitation.status !== 'pending' || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()
    if (
      invitationExpired ||
      !trustedPerson ||
      trustedPerson.invitation_status !== 'accepted' ||
      !trustedPerson.is_active ||
      trustedPerson.relationship_status === 'revoked'
    ) {
      return NextResponse.json(
        {
          status: invitation.status === 'revoked' || trustedPerson?.relationship_status === 'revoked' ? 'revoked' : 'expired_invitation',
          userMessageKey:
            invitation.status === 'revoked' || trustedPerson?.relationship_status === 'revoked'
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
      relationshipStatus: trustedPerson.relationship_status,
      expectedEmail: trustedPerson.email,
      ownerName: ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner',
      invitationExpiresAt: invitation.expires_at,
      otpVerified: Boolean(
        invitation.otp_verified_at ||
        (otpCookie && otpCookie.invitationId === invitation.id && otpCookie.userId === user?.id)
      ),
      userMessageKey: wrongAccount ? 'secure_access_wrong_account' : 'secure_access_setup_required',
    })

    if (!pendingCookie || pendingCookie.invitationId !== invitation.id) {
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
