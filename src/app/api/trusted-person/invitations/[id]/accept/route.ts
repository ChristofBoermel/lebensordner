import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import { emitTrustedAccessEvent } from '@/lib/security/trusted-access'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/trusted-person/invitations/[id]/accept'
    )

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createServiceRoleSupabaseClient()
    const { data: relationship, error: relationshipError } = await adminClient
      .from('trusted_persons')
      .select('id, email, linked_user_id, invitation_status, invitation_expires_at, is_active')
      .eq('id', id)
      .maybeSingle()

    if (relationshipError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Person Invitation Accept API] Failed to load invitation: ${relationshipError.message}`,
        endpoint: '/api/trusted-person/invitations/[id]/accept',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!relationship || !relationship.is_active) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (relationship.invitation_status === 'accepted') {
      return NextResponse.json({ success: true, relationshipStatus: 'accepted_pending_setup' })
    }

    if (relationship.invitation_status !== 'pending' && relationship.invitation_status !== 'sent') {
      return NextResponse.json({ error: 'Invitation unavailable' }, { status: 409 })
    }

    const normalizedExpectedEmail = relationship.email.toLowerCase().trim()
    const normalizedUserEmail = user.email?.toLowerCase().trim() ?? ''
    if (normalizedExpectedEmail !== normalizedUserEmail) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Person Invitation Accept API] Exact invited email mismatch',
        endpoint: '/api/trusted-person/invitations/[id]/accept',
        metadata: {
          relationshipId: id,
          userId: user.id,
        },
      })
      return NextResponse.json({ error: 'wrong_account' }, { status: 403 })
    }

    const expiresAtMs = relationship.invitation_expires_at
      ? new Date(relationship.invitation_expires_at).getTime()
      : NaN
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })
    }

    const nowIso = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from('trusted_persons')
      .update({
        invitation_status: 'accepted',
        invitation_accepted_at: nowIso,
        linked_user_id: user.id,
        relationship_status: 'accepted_pending_setup',
        updated_at: nowIso,
      })
      .eq('id', id)

    if (updateError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Person Invitation Accept API] Failed to accept invitation: ${updateError.message}`,
        endpoint: '/api/trusted-person/invitations/[id]/accept',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    try {
      await emitTrustedAccessEvent(adminClient, {
        relationshipId: id,
        actorUserId: user.id,
        eventType: 'accepted',
      })
    } catch (eventError: any) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Person Invitation Accept API] Failed to record accepted event: ${eventError?.message ?? String(eventError)}`,
        endpoint: '/api/trusted-person/invitations/[id]/accept',
      })
    }

    return NextResponse.json({
      success: true,
      relationshipStatus: 'accepted_pending_setup',
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Trusted Person Invitation Accept API] Unexpected error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-person/invitations/[id]/accept',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
