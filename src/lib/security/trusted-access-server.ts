import type { SupabaseClient } from '@supabase/supabase-js'
import { emitStructuredInfo } from '@/lib/errors/structured-logger'

export type TrustedAccessTrustedPersonRelation = {
  id: string
  user_id: string
  email: string
  linked_user_id: string | null
  invitation_status: string
  relationship_status: string
  is_active: boolean
}

export type TrustedAccessOwnerProfile = {
  full_name: string | null
  email: string | null
}

export function normalizeSingleRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation
}

export function buildTrustedAccessOwnerName(
  ownerProfile: TrustedAccessOwnerProfile | null | undefined
) {
  return ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner'
}

type ResolveOwnerProfileInput = {
  adminClient: SupabaseClient
  endpoint: string
  operation: string
  trustedPerson: TrustedAccessTrustedPersonRelation | null | undefined
  invitationId?: string
  requestId?: string | null
}

export async function resolveTrustedAccessOwnerProfile(
  input: ResolveOwnerProfileInput
): Promise<TrustedAccessOwnerProfile | null> {
  const { adminClient, endpoint, operation, trustedPerson, invitationId, requestId } = input

  if (!trustedPerson?.user_id) {
    return null
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', trustedPerson.user_id)
    .maybeSingle()

  if (error) {
    emitStructuredInfo({
      event_type: 'api',
      event_message: '[Trusted Access API] Owner profile lookup failed; using fallback owner label',
      endpoint,
      metadata: {
        operation,
        invitationId: invitationId ?? null,
        trustedPersonId: trustedPerson.id,
        ownerUserId: trustedPerson.user_id,
        requestId: requestId ?? null,
        errorCode: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      },
    })
    return null
  }

  return data
}
