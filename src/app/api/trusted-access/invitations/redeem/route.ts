import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import {
  createTrustedAccessPendingCookie,
  emitTrustedAccessEvent,
  hashTrustedAccessToken,
  TRUSTED_ACCESS_PENDING_COOKIE,
} from '@/lib/security/trusted-access'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePublicOrigin } from '@/lib/url/public-origin'

function setPendingInvitationCookie(
  response: NextResponse,
  invitation: {
    id: string
    owner_id: string
    trusted_person_id: string
  },
  expectedEmail: string,
  maxAgeSeconds = 24 * 60 * 60
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
    maxAge: maxAgeSeconds,
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const publicOrigin = resolvePublicOrigin(request)
  const token = url.searchParams.get('token')?.trim() ?? ''

  if (!token) {
    return NextResponse.redirect(new URL('/zugriff/access/redeem?status=expired', publicOrigin))
  }

  try {
    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/trusted-access/invitations/redeem'
    )
    const adminClient = createServiceRoleSupabaseClient()

    const tokenHash = hashTrustedAccessToken(token)
    const { data: invitation, error: invitationError } = await adminClient
      .from('trusted_access_invitations')
      .select(`
        id,
        owner_id,
        trusted_person_id,
        status,
        expires_at,
        claimed_at,
        trusted_persons:trusted_person_id (
          id,
          email,
          linked_user_id,
          invitation_status,
          relationship_status,
          is_active
        )
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (invitationError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Redeem API] Failed to load invitation: ${invitationError.message}`,
        endpoint: '/api/trusted-access/invitations/redeem',
      })
      return NextResponse.redirect(new URL('/zugriff/access/redeem?status=expired', publicOrigin))
    }

    const trustedPerson = Array.isArray(invitation?.trusted_persons)
      ? invitation?.trusted_persons[0]
      : invitation?.trusted_persons

    const expiresAtMs = invitation?.expires_at ? new Date(invitation.expires_at).getTime() : NaN
    const isExpired = !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()
    const invalidInvitation =
      !invitation ||
      !trustedPerson ||
      trustedPerson.invitation_status !== 'accepted' ||
      !trustedPerson.is_active ||
      (trustedPerson.relationship_status !== 'accepted_pending_setup' &&
        trustedPerson.relationship_status !== 'setup_link_sent' &&
        trustedPerson.relationship_status !== 'active')

    if (invalidInvitation || invitation.status !== 'pending' || isExpired) {
      const nextStatus =
        invitation?.status === 'revoked'
          ? 'revoked'
          : invitation?.status === 'replaced' || invitation?.status === 'redeemed' || isExpired
            ? 'expired'
            : 'expired'

      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access Redeem API] Invitation rejected before redemption',
        endpoint: '/api/trusted-access/invitations/redeem',
        metadata: {
          status: invitation?.status ?? null,
          invitationId: invitation?.id ?? null,
        },
      })

      return NextResponse.redirect(new URL(`/zugriff/access/redeem?status=${nextStatus}`, publicOrigin))
    }

    if (!user) {
      const nextPath = `/zugriff/access/redeem?token=${encodeURIComponent(token)}`
      const loginRedirectResponse = NextResponse.redirect(
        new URL(`/anmelden?next=${encodeURIComponent(nextPath)}`, publicOrigin)
      )
      setPendingInvitationCookie(loginRedirectResponse, invitation, trustedPerson.email)
      return loginRedirectResponse
    }

    const normalizedUserEmail = user.email?.toLowerCase().trim() ?? ''
    const normalizedExpectedEmail = trustedPerson.email.toLowerCase().trim()

    if (trustedPerson.linked_user_id !== user.id || normalizedUserEmail !== normalizedExpectedEmail) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access Redeem API] Wrong account redemption attempt',
        endpoint: '/api/trusted-access/invitations/redeem',
        metadata: {
          invitationId: invitation.id,
          ownerId: invitation.owner_id,
          trustedPersonId: invitation.trusted_person_id,
          userId: user.id,
        },
      })

      const wrongAccountRedirectResponse = NextResponse.redirect(
        new URL('/zugriff/access/redeem?status=wrong_account', publicOrigin)
      )
      setPendingInvitationCookie(wrongAccountRedirectResponse, invitation, trustedPerson.email)
      return wrongAccountRedirectResponse
    }

    if (!invitation.claimed_at) {
      const nowIso = new Date().toISOString()
      await adminClient
        .from('trusted_access_invitations')
        .update({ claimed_at: nowIso })
        .eq('id', invitation.id)

      if (trustedPerson.relationship_status === 'accepted_pending_setup') {
        await adminClient
          .from('trusted_persons')
          .update({ relationship_status: 'setup_link_sent', updated_at: nowIso })
          .eq('id', invitation.trusted_person_id)
      }

      try {
        await emitTrustedAccessEvent(adminClient, {
          relationshipId: invitation.trusted_person_id,
          actorUserId: user.id,
          eventType: 'setup_started',
          metadata: {
            invitationId: invitation.id,
          },
        })
      } catch (eventError: any) {
        emitStructuredError({
          error_type: 'api',
          error_message: `[Trusted Access Redeem API] Failed to record setup_started event: ${eventError?.message ?? String(eventError)}`,
          endpoint: '/api/trusted-access/invitations/redeem',
        })
      }
    }

    const response = NextResponse.redirect(new URL('/zugriff/access/redeem', publicOrigin))
    setPendingInvitationCookie(response, invitation, trustedPerson.email)
    return response
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Trusted Access Redeem API] Unexpected error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-access/invitations/redeem',
      stack: error?.stack,
    })
    return NextResponse.redirect(new URL('/zugriff/access/redeem?status=expired', publicOrigin))
  }
}
