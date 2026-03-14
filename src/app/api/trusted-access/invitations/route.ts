import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
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

function buildDatabaseErrorMetadata(
  operation: string,
  trustedPersonId: string,
  ownerId: string,
  error: {
    code?: string | null
    details?: string | null
    hint?: string | null
    message?: string | null
  },
  relationshipStatus?: string | null
) {
  return {
    operation,
    ownerId,
    trustedPersonId,
    relationshipStatus: relationshipStatus ?? null,
    errorCode: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  }
}

function isMissingColumnError(error: { code?: string | null; message?: string | null }, column: string) {
  return (
    error.code === '42703' ||
    String(error.message ?? '').toLowerCase().includes(`column "${column.toLowerCase()}"`)
  )
}

function isLegacyRelationshipStatusConstraintError(error: {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}) {
  const normalized = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return (
    error.code === '23514' &&
    (normalized.includes('trusted_persons_relationship_status_check') ||
      normalized.includes('setup_link_sent') ||
      normalized.includes('relationship_status'))
  )
}

function isRelationshipStatusSchemaCacheError(error: {
  code?: string | null
  message?: string | null
}) {
  const normalized = `${error.message ?? ''}`.toLowerCase()
  return (
    error.code === 'PGRST204' &&
    normalized.includes("could not find the 'relationship_status' column") &&
    normalized.includes('schema cache')
  )
}

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
        metadata: buildDatabaseErrorMetadata(
          'load_trusted_person',
          trustedPersonId,
          user.id,
          trustedPersonError
        ),
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

    let { error: replaceInvitationError } = await adminClient
      .from('trusted_access_invitations')
      .update({ status: 'replaced', revoked_at: nowIso })
      .eq('owner_id', user.id)
      .eq('trusted_person_id', trustedPersonId)
      .eq('status', 'pending')

    if (replaceInvitationError && isMissingColumnError(replaceInvitationError, 'revoked_at')) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: '[Trusted Access Invitations API] Retrying invitation replacement without revoked_at due to legacy schema drift',
        endpoint: '/api/trusted-access/invitations',
        metadata: buildDatabaseErrorMetadata(
          'replace_prior_pending_invitation_legacy_retry',
          trustedPersonId,
          user.id,
          replaceInvitationError,
          trustedPerson.relationship_status
        ),
      })

      const fallbackResult = await adminClient
        .from('trusted_access_invitations')
        .update({ status: 'replaced' })
        .eq('owner_id', user.id)
        .eq('trusted_person_id', trustedPersonId)
        .eq('status', 'pending')

      replaceInvitationError = fallbackResult.error
    }

    if (replaceInvitationError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Invitations API] Failed to replace prior invitation: ${replaceInvitationError.message}`,
        endpoint: '/api/trusted-access/invitations',
        metadata: buildDatabaseErrorMetadata(
          'replace_prior_pending_invitation',
          trustedPersonId,
          user.id,
          replaceInvitationError,
          trustedPerson.relationship_status
        ),
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
        metadata: buildDatabaseErrorMetadata(
          'insert_trusted_access_invitation',
          trustedPersonId,
          user.id,
          invitationError ?? {},
          trustedPerson.relationship_status
        ),
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
      if (isLegacyRelationshipStatusConstraintError(relationshipError)) {
        emitStructuredWarn({
          event_type: 'api',
          event_message: '[Trusted Access Invitations API] Skipped relationship_status transition to setup_link_sent due to legacy constraint drift',
          endpoint: '/api/trusted-access/invitations',
          metadata: buildDatabaseErrorMetadata(
            'advance_relationship_status_legacy_constraint',
            trustedPersonId,
            user.id,
            relationshipError,
            trustedPerson.relationship_status
          ),
        })
      } else if (isRelationshipStatusSchemaCacheError(relationshipError)) {
        emitStructuredWarn({
          event_type: 'api',
          event_message: '[Trusted Access Invitations API] Skipped relationship_status transition due to stale PostgREST schema cache',
          endpoint: '/api/trusted-access/invitations',
          metadata: buildDatabaseErrorMetadata(
            'advance_relationship_status_schema_cache',
            trustedPersonId,
            user.id,
            relationshipError,
            trustedPerson.relationship_status
          ),
        })
      } else {
        emitStructuredError({
          error_type: 'api',
          error_message: `[Trusted Access Invitations API] Failed to advance relationship status: ${relationshipError.message}`,
          endpoint: '/api/trusted-access/invitations',
          metadata: buildDatabaseErrorMetadata(
            'advance_relationship_status',
            trustedPersonId,
            user.id,
            relationshipError,
            trustedPerson.relationship_status
          ),
        })
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
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
