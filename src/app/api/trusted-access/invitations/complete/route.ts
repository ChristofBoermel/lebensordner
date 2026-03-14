import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import {
  createTrustedAccessDeviceCookie,
  decryptTrustedAccessBootstrap,
  emitTrustedAccessEvent,
  hashTrustedAccessToken,
  readCookieValueFromHeader,
  readTrustedAccessOtpCookie,
  readTrustedAccessPendingCookie,
  TRUSTED_ACCESS_DEVICE_COOKIE,
  TRUSTED_ACCESS_OTP_COOKIE,
  TRUSTED_ACCESS_PENDING_COOKIE,
} from '@/lib/security/trusted-access'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const pendingCookie = readTrustedAccessPendingCookie(
      readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_PENDING_COOKIE)
    )
    const otpCookie = readTrustedAccessOtpCookie(
      readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_OTP_COOKIE)
    )

    if (!pendingCookie) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/trusted-access/invitations/complete'
    )

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!otpCookie || otpCookie.invitationId !== pendingCookie.invitationId || otpCookie.userId !== user.id) {
      return NextResponse.json({ error: 'OTP required' }, { status: 403 })
    }

    const adminClient = createServiceRoleSupabaseClient()
    const { data: invitation, error: invitationError } = await adminClient
      .from('trusted_access_invitations')
      .select(`
        id,
        owner_id,
        trusted_person_id,
        status,
        expires_at,
        metadata,
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
      .eq('id', pendingCookie.invitationId)
      .maybeSingle()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    const trustedPerson = Array.isArray(invitation.trusted_persons)
      ? invitation.trusted_persons[0]
      : invitation.trusted_persons
    const ownerProfile = Array.isArray(invitation.profiles)
      ? invitation.profiles[0]
      : invitation.profiles

    const wrongAccount =
      !trustedPerson ||
      trustedPerson.linked_user_id !== user.id ||
      trustedPerson.email.toLowerCase().trim() !== (user.email?.toLowerCase().trim() ?? '')

    const expired = new Date(invitation.expires_at).getTime() <= Date.now()
    if (
      wrongAccount ||
      invitation.status !== 'pending' ||
      expired ||
      trustedPerson.invitation_status !== 'accepted' ||
      !trustedPerson.is_active ||
      trustedPerson.relationship_status === 'revoked'
    ) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access Complete API] Invitation completion rejected',
        endpoint: '/api/trusted-access/invitations/complete',
        metadata: {
          invitationId: invitation.id,
          status: invitation.status,
          userId: user.id,
        },
      })
      return NextResponse.json({ error: wrongAccount ? 'Wrong account' : 'Link expired' }, { status: wrongAccount ? 403 : 410 })
    }

    const bootstrapRelationshipKey = decryptTrustedAccessBootstrap(
      (invitation.metadata as Record<string, string> | null)?.bootstrapRelationshipKey
    )

    if (!bootstrapRelationshipKey || !/^[0-9a-f]{64}$/i.test(bootstrapRelationshipKey)) {
      emitStructuredError({
        error_type: 'api',
        error_message: '[Trusted Access Complete API] Missing bootstrap relationship key',
        endpoint: '/api/trusted-access/invitations/complete',
        metadata: { invitationId: invitation.id },
      })
      return NextResponse.json({ error: 'Bootstrap unavailable' }, { status: 500 })
    }

    const deviceSecret = randomBytes(32).toString('hex')
    const deviceSecretHash = hashTrustedAccessToken(deviceSecret)
    const nowIso = new Date().toISOString()

    const { data: device, error: deviceError } = await adminClient
      .from('trusted_access_devices')
      .insert({
        owner_id: invitation.owner_id,
        trusted_person_id: invitation.trusted_person_id,
        user_id: user.id,
        device_label: request.headers.get('user-agent')?.slice(0, 120) ?? null,
        device_secret_hash: deviceSecretHash,
        created_from_invitation_id: invitation.id,
        last_used_at: nowIso,
      })
      .select('id')
      .single()

    if (deviceError || !device) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Complete API] Failed to create device enrollment: ${deviceError?.message ?? 'unknown error'}`,
        endpoint: '/api/trusted-access/invitations/complete',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    await adminClient
      .from('trusted_access_invitations')
      .update({
        status: 'redeemed',
        redeemed_at: nowIso,
        redeemed_by_user_id: user.id,
        redeemed_device_id: device.id,
      })
      .eq('id', invitation.id)

    await adminClient
      .from('trusted_persons')
      .update({
        relationship_status: 'active',
        updated_at: nowIso,
      })
      .eq('id', invitation.trusted_person_id)

    try {
      await emitTrustedAccessEvent(adminClient, {
        relationshipId: invitation.trusted_person_id,
        actorUserId: user.id,
        eventType: 'device_enrolled',
        metadata: {
          invitationId: invitation.id,
          deviceId: device.id,
        },
      })
    } catch (eventError: any) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access Complete API] Failed to record device_enrolled event: ${eventError?.message ?? String(eventError)}`,
        endpoint: '/api/trusted-access/invitations/complete',
      })
    }

    const response = NextResponse.json({
      success: true,
      ownerId: invitation.owner_id,
      ownerName: ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner',
      relationshipKey: bootstrapRelationshipKey,
      redirectTo: `/vp-dashboard/view/${invitation.owner_id}`,
    })

    response.cookies.set({
      name: TRUSTED_ACCESS_DEVICE_COOKIE,
      value: createTrustedAccessDeviceCookie(
        {
          deviceId: device.id,
          ownerId: invitation.owner_id,
          trustedPersonId: invitation.trusted_person_id,
          userId: user.id,
          deviceSecret,
        },
        readCookieValueFromHeader(request.headers.get('cookie'), TRUSTED_ACCESS_DEVICE_COOKIE)
      ),
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    })
    response.cookies.set({
      name: TRUSTED_ACCESS_PENDING_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 0,
    })
    response.cookies.set({
      name: TRUSTED_ACCESS_OTP_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Trusted Access Complete API] Unexpected error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-access/invitations/complete',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
