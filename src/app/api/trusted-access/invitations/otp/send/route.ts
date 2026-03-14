import { NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import { sendEmailWithTimeout } from '@/lib/email/resend-service'
import {
  buildTrustedAccessOwnerName,
  normalizeSingleRelation,
  resolveTrustedAccessOwnerProfile,
  type TrustedAccessTrustedPersonRelation,
} from '@/lib/security/trusted-access-server'
import {
  buildTrustedAccessOtpExpiry,
  generateTrustedAccessOtp,
  hashTrustedAccessOtp,
  readCookieValueFromHeader,
  readTrustedAccessPendingCookie,
  TRUSTED_ACCESS_OTP_MAX_ATTEMPTS,
  TRUSTED_ACCESS_PENDING_COOKIE,
} from '@/lib/security/trusted-access'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function buildOtpEmail(input: { ownerName: string; otp: string }): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2>Sicherer Dokumentenzugang bestaetigen</h2>
      <p>Geben Sie diesen Code ein, um den sicheren Zugriff auf diesem Geraet einzurichten:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${input.otp}</p>
      <p>Freigebender Lebensordner: ${input.ownerName}</p>
      <p>Der Code ist 10 Minuten gueltig.</p>
    </div>
  `
}

type OtpInvitationRecord = {
  id: string
  owner_id: string
  status: string
  expires_at: string
  trusted_persons: TrustedAccessTrustedPersonRelation | TrustedAccessTrustedPersonRelation[] | null
}

export async function POST(request: Request) {
  try {
    const requestId = request.headers.get('x-request-id')?.trim() || null
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
      '/api/trusted-access/invitations/otp/send'
    )

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createServiceRoleSupabaseClient()
    const { data: invitation, error: invitationError } = await adminClient
      .from('trusted_access_invitations')
      .select(`
        id,
        owner_id,
        status,
        expires_at,
        trusted_persons:trusted_person_id (
          id,
          user_id,
          email,
          linked_user_id,
          invitation_status,
          relationship_status,
          is_active
        )
      `)
      .eq('id', pendingCookie.invitationId)
      .maybeSingle()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    const trustedPerson = normalizeSingleRelation(
      (invitation as OtpInvitationRecord).trusted_persons
    )

    const wrongAccount =
      !trustedPerson ||
      trustedPerson.linked_user_id !== user.id ||
      trustedPerson.email.toLowerCase().trim() !== (user.email?.toLowerCase().trim() ?? '')

    const expired = new Date(invitation.expires_at).getTime() <= Date.now()
    const invalidRelationship =
      !trustedPerson ||
      trustedPerson.invitation_status !== 'accepted' ||
      !trustedPerson.is_active ||
      trustedPerson.relationship_status === 'revoked'

    if (wrongAccount) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access OTP Send API] Wrong account blocked from OTP send',
        endpoint: '/api/trusted-access/invitations/otp/send',
        metadata: {
          requestId,
          invitationId: pendingCookie.invitationId,
          userId: user.id,
        },
      })
      return NextResponse.json({ error: 'Wrong account' }, { status: 403 })
    }

    if (invitation.status !== 'pending' || expired || invalidRelationship) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    await adminClient
      .from('trusted_access_otp_challenges')
      .delete()
      .eq('invitation_id', invitation.id)
      .is('consumed_at', null)

    const otp = generateTrustedAccessOtp()
    const expiresAt = buildTrustedAccessOtpExpiry()

    const { error: otpInsertError } = await adminClient
      .from('trusted_access_otp_challenges')
      .insert({
        invitation_id: invitation.id,
        trusted_person_id: trustedPerson.id,
        code_hash: hashTrustedAccessOtp(otp),
        expires_at: expiresAt,
        max_attempts: TRUSTED_ACCESS_OTP_MAX_ATTEMPTS,
      })

    if (otpInsertError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Trusted Access OTP Send API] Failed to create OTP challenge: ${otpInsertError.message}`,
        endpoint: '/api/trusted-access/invitations/otp/send',
        metadata: {
          requestId,
          operation: 'create_otp_challenge',
          invitationId: invitation.id,
          trustedPersonId: trustedPerson.id,
          errorCode: otpInsertError.code ?? null,
          details: otpInsertError.details ?? null,
          hint: otpInsertError.hint ?? null,
        },
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const ownerProfile = await resolveTrustedAccessOwnerProfile({
      adminClient,
      endpoint: '/api/trusted-access/invitations/otp/send',
      operation: 'otp_owner_profile_lookup',
      trustedPerson,
      invitationId: invitation.id,
      requestId,
    })

    const emailResult = await sendEmailWithTimeout({
      from: 'Lebensordner <noreply@lebensordner.org>',
      to: trustedPerson.email,
      subject: 'Code fuer sicheren Dokumentenzugang',
      html: buildOtpEmail({
        ownerName: buildTrustedAccessOwnerName(ownerProfile),
        otp,
      }),
    })

    if (!emailResult.success && !emailResult.pendingInFlight) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: '[Trusted Access OTP Send API] OTP delivery failed',
        endpoint: '/api/trusted-access/invitations/otp/send',
        metadata: {
          requestId,
          invitationId: invitation.id,
          trustedPersonId: trustedPerson.id,
          error: emailResult.error ?? null,
        },
      })
      return NextResponse.json({ error: 'OTP delivery failed' }, { status: 503 })
    }

    return NextResponse.json({
      success: true,
      expiresAt,
      maxAttempts: TRUSTED_ACCESS_OTP_MAX_ATTEMPTS,
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Trusted Access OTP Send API] Unexpected error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-access/invitations/otp/send',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
