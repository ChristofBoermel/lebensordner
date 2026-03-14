import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import {
  buildOwnerTrustedAccessStatus,
  buildTrustedAccessReadiness,
  resolveTrustedAccessNextAction,
  fetchLatestTrustedAccessInvitationMap,
  fetchTrustedAccessDevicePairSet,
  readCookieValueFromHeader,
  TRUSTED_ACCESS_DEVICE_COOKIE,
  validateTrustedAccessDevice,
} from '@/lib/security/trusted-access'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/trusted-access/relationship-status'
    )

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')?.trim() ?? ''
    const trustedPersonId = searchParams.get('trustedPersonId')?.trim() ?? ''
    const adminClient = createServiceRoleSupabaseClient()

    let relationshipQuery = adminClient
      .from('trusted_persons')
      .select('id, user_id, linked_user_id, invitation_status, relationship_status, invitation_expires_at, is_active')

    if (trustedPersonId) {
      relationshipQuery = relationshipQuery.eq('id', trustedPersonId).eq('user_id', user.id)
    } else if (ownerId) {
      relationshipQuery = relationshipQuery.eq('user_id', ownerId).eq('linked_user_id', user.id)
    } else {
      return NextResponse.json({ error: 'ownerId or trustedPersonId required' }, { status: 400 })
    }

    const { data: relationship, error: relationshipError } = await relationshipQuery.maybeSingle()

    if (relationshipError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Relationship Status API] Failed to load relationship: ${relationshipError.message}`,
        endpoint: '/api/trusted-access/relationship-status',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!relationship) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const resolvedOwnerId = relationship.user_id
    const resolvedTrustedPersonId = relationship.id

    const [{ count: shareCount, error: shareCountError }, invitationMap] = await Promise.all([
      adminClient
        .from('document_share_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', resolvedOwnerId)
        .eq('trusted_person_id', resolvedTrustedPersonId)
        .is('revoked_at', null),
      fetchLatestTrustedAccessInvitationMap(adminClient, [{
        ownerId: resolvedOwnerId,
        trustedPersonId: resolvedTrustedPersonId,
      }]),
    ])

    if (shareCountError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Relationship Status API] Failed to load share count: ${shareCountError.message}`,
        endpoint: '/api/trusted-access/relationship-status',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const invitationStatus = invitationMap.get(`${resolvedOwnerId}:${resolvedTrustedPersonId}`)
    const hasExplicitShares = (shareCount ?? 0) > 0

    const isOwnerView = relationship.user_id === user.id
    let hasDeviceEnrollment = false
    let deviceRevoked = false

    if (isOwnerView) {
      const pairSet = await fetchTrustedAccessDevicePairSet(adminClient, [{
        ownerId: resolvedOwnerId,
        trustedPersonId: resolvedTrustedPersonId,
      }])
      hasDeviceEnrollment = pairSet.has(`${resolvedOwnerId}:${resolvedTrustedPersonId}:*`)
    } else {
      const validation = await validateTrustedAccessDevice(adminClient, {
        rawCookieValue: readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_DEVICE_COOKIE),
        ownerId: resolvedOwnerId,
        trustedPersonId: resolvedTrustedPersonId,
        userId: user.id,
      })
      hasDeviceEnrollment = validation.enrolled
      deviceRevoked = validation.revoked
    }

    const readiness = buildTrustedAccessReadiness({
      hasExplicitShares,
      hasDeviceEnrollment,
      deviceRevoked,
      latestInvitationStatus: invitationStatus?.status ?? null,
      relationshipStatus: relationship.relationship_status,
    })

    const ownerStatus = buildOwnerTrustedAccessStatus({
      hasExplicitShares,
      hasPendingInvitation: invitationStatus?.status === 'pending',
      invitationExpiresAt: invitationStatus?.expiresAt ?? relationship.invitation_expires_at ?? null,
      hasDeviceEnrollment,
      relationshipStatus: relationship.relationship_status,
    })

    return NextResponse.json({
      ownerId: resolvedOwnerId,
      trustedPersonId: resolvedTrustedPersonId,
      relationshipStatus: relationship.relationship_status,
      invitationStatus: invitationStatus?.status ?? relationship.invitation_status ?? null,
      invitationExpiresAt: invitationStatus?.expiresAt ?? relationship.invitation_expires_at ?? null,
      hasExplicitShares,
      hasDeviceEnrollment,
      access: isOwnerView ? ownerStatus : readiness,
      nextAction: resolveTrustedAccessNextAction({
        relationshipStatus: relationship.relationship_status,
        hasDeviceEnrollment,
        hasExplicitShares,
      }),
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Trusted Access Relationship Status API] Unexpected error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-access/relationship-status',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
