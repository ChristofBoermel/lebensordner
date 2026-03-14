import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import {
  buildTrustedAccessSetupLinkExpiry,
  emitTrustedAccessEvent,
  encryptTrustedAccessBootstrap,
  generateTrustedAccessToken,
  hashTrustedAccessToken,
  TRUSTED_ACCESS_SETUP_LINK_TTL_HOURS,
} from '@/lib/security/trusted-access'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePublicOrigin } from '@/lib/url/public-origin'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/trusted-access/invitations'
    )

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const trustedPersonId = typeof body?.trustedPersonId === 'string' ? body.trustedPersonId : ''
    const bootstrapRelationshipKey =
      typeof body?.bootstrapRelationshipKey === 'string' ? body.bootstrapRelationshipKey.trim() : ''

    if (!trustedPersonId || !/^[0-9a-f]{64}$/i.test(bootstrapRelationshipKey)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const adminClient = createServiceRoleSupabaseClient()

    const { data: trustedPerson, error: trustedPersonError } = await adminClient
      .from('trusted_persons')
      .select('id, email, linked_user_id, invitation_status, relationship_status, is_active')
      .eq('id', trustedPersonId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (trustedPersonError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Invitations API] Failed to load trusted person: ${trustedPersonError.message}`,
        endpoint: '/api/trusted-access/invitations',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (
      !trustedPerson ||
      trustedPerson.invitation_status !== 'accepted' ||
      !trustedPerson.is_active ||
      !trustedPerson.linked_user_id ||
      (trustedPerson.relationship_status !== 'accepted_pending_setup' &&
        trustedPerson.relationship_status !== 'setup_link_sent')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const nowIso = new Date().toISOString()
    const expiresAt = buildTrustedAccessSetupLinkExpiry()

    const { error: replaceInvitationError } = await adminClient
      .from('trusted_access_invitations')
      .update({ status: 'replaced', revoked_at: nowIso })
      .eq('owner_id', user.id)
      .eq('trusted_person_id', trustedPersonId)
      .eq('status', 'pending')

    if (replaceInvitationError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Invitations API] Failed to replace prior invitation: ${replaceInvitationError.message}`,
        endpoint: '/api/trusted-access/invitations',
        metadata: {
          ownerId: user.id,
          trustedPersonId,
        },
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const token = generateTrustedAccessToken()
    const tokenHash = hashTrustedAccessToken(token)

    const { data: invitation, error: invitationError } = await adminClient
      .from('trusted_access_invitations')
      .insert({
        owner_id: user.id,
        trusted_person_id: trustedPersonId,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: expiresAt,
        created_by_user_id: user.id,
        last_sent_at: nowIso,
        metadata: {
          bootstrapRelationshipKey: encryptTrustedAccessBootstrap(bootstrapRelationshipKey),
        },
      })
      .select('id, expires_at')
      .single()

    if (invitationError || !invitation) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Invitations API] Failed to create invitation: ${invitationError?.message ?? 'unknown error'}`,
        endpoint: '/api/trusted-access/invitations',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const { error: relationshipError } = await adminClient
      .from('trusted_persons')
      .update({
        relationship_status: 'setup_link_sent',
        updated_at: nowIso,
      })
      .eq('id', trustedPersonId)
      .eq('user_id', user.id)

    if (relationshipError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Invitations API] Failed to advance relationship status: ${relationshipError.message}`,
        endpoint: '/api/trusted-access/invitations',
        metadata: {
          ownerId: user.id,
          trustedPersonId,
        },
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    try {
      await emitTrustedAccessEvent(adminClient, {
        relationshipId: trustedPersonId,
        actorUserId: user.id,
        eventType: 'setup_link_sent',
        metadata: {
          invitationId: invitation.id,
          expiresAt: invitation.expires_at,
        },
      })
    } catch (eventError: any) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Invitations API] Failed to record trusted-access event: ${eventError?.message ?? String(eventError)}`,
        endpoint: '/api/trusted-access/invitations',
        metadata: {
          ownerId: user.id,
          trustedPersonId,
          invitationId: invitation.id,
        },
      })
    }

    const origin = resolvePublicOrigin(request)
    const invitationUrl = `${origin}/api/trusted-access/invitations/redeem?token=${encodeURIComponent(token)}`

    return NextResponse.json({
      invitationUrl,
      expiresAt: invitation.expires_at,
      status: 'pending',
      deliveryMode: 'manual',
      singleUse: true,
      expiresInHours: TRUSTED_ACCESS_SETUP_LINK_TTL_HOURS,
    })
  } catch (error: any) {
    const errorMessage = error?.message ?? String(error)
    const errorType = /service-role environment variables/i.test(errorMessage) ? 'config' : 'api'

    emitStructuredError({
      error_type: errorType,
      error_message: `[Trusted Access Invitations API] Unexpected error: ${errorMessage}`,
      endpoint: '/api/trusted-access/invitations',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
