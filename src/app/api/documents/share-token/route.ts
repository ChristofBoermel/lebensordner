import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isActiveShareToken } from '@/lib/security/share-token-status'
import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from '@/lib/security/share-token-compat'
import {
  buildManualAccessLinkGuidance,
  fetchRelationshipKeyPairSet,
  hasRelationshipKeyForPair,
} from '@/lib/security/access-link-readiness'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

type ShareTokenError = {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}

type OwnerShareTokenBaseRow = {
  id: string
  document_id: string
  trusted_person_id: string
  wrapped_dek_for_tp: string
  expires_at?: string | null
  permission?: string
  revoked_at?: string | null
  created_at: string
}

type OwnerShareDocumentRow = {
  id: string
  title: string
  category: string
  file_name: string
}

type OwnerTrustedPersonRow = {
  id: string
  name: string
  email: string
}

type OwnerShareTokenRow = OwnerShareTokenBaseRow & {
  documents: OwnerShareDocumentRow | null
  trusted_persons: OwnerTrustedPersonRow | null
  access_link_setup: ReturnType<typeof buildManualAccessLinkGuidance>
}

async function fetchOwnerShareRows(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, ownerId: string) {
  let data: OwnerShareTokenBaseRow[] | null = null
  let error: ShareTokenError | null = null

  {
    const result = await supabase
      .from('document_share_tokens')
      .select('id, document_id, trusted_person_id, wrapped_dek_for_tp, expires_at, permission, revoked_at, created_at')
      .eq('owner_id', ownerId)

    data = (result.data ?? null) as OwnerShareTokenBaseRow[] | null
    error = result.error
  }

  if (isLegacyShareTokenSchemaError(error)) {
    emitStructuredWarn({
      event_type: 'api',
      event_message: '[Share Token API] Falling back to legacy share-token schema for owner list',
      endpoint: '/api/documents/share-token',
      metadata: {
        operation: 'list_owner',
        code: error?.code ?? null,
        message: error?.message ?? null,
      },
    })

    const legacyResult = await supabase
      .from('document_share_tokens')
      .select('id, document_id, trusted_person_id, wrapped_dek_for_tp, created_at')
      .eq('owner_id', ownerId)

    data = (legacyResult.data ?? null) as OwnerShareTokenBaseRow[] | null
    error = legacyResult.error
  }

  return { data, error }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { documentId, trustedPersonId, wrapped_dek_for_tp, expires_at, permission } = body || {}

  if (!documentId || !trustedPersonId || !wrapped_dek_for_tp) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: document } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!document) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: trustedPerson } = await supabase
    .from('trusted_persons')
    .select('id, linked_user_id')
    .eq('id', trustedPersonId)
    .eq('user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .maybeSingle()

  if (!trustedPerson) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (trustedPerson.linked_user_id === null) {
    return NextResponse.json({ error: 'Trusted person has not accepted the invitation' }, { status: 403 })
  }

  const fullPayload = {
    document_id: documentId,
    owner_id: user.id,
    trusted_person_id: trustedPersonId,
    wrapped_dek_for_tp,
    expires_at: expires_at ?? null,
    permission: permission ?? 'view',
    revoked_at: null,
  }

  let { error } = await supabase
    .from('document_share_tokens')
    .upsert(fullPayload, { onConflict: 'document_id,trusted_person_id' })

  if (isLegacyShareTokenSchemaError(error)) {
    emitStructuredWarn({
      event_type: 'api',
      event_message: '[Share Token API] Falling back to legacy share-token schema for create',
      endpoint: '/api/documents/share-token',
      metadata: {
        operation: 'create',
        code: error?.code ?? null,
        message: error?.message ?? null,
      },
    })

    ;({ error } = await supabase
      .from('document_share_tokens')
      .upsert({
        document_id: documentId,
        owner_id: user.id,
        trusted_person_id: trustedPersonId,
        wrapped_dek_for_tp,
      }, { onConflict: 'document_id,trusted_person_id' }))
  }

  if (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Share Token API] Error creating share token: ${error.message}`,
      endpoint: '/api/documents/share-token',
      metadata: {
        operation: 'create',
        code: error.code ?? null,
      },
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ownerId = searchParams.get('ownerId')

  if (!ownerId) {
    return NextResponse.json({ error: 'ownerId parameter required' }, { status: 400 })
  }

  if (ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await fetchOwnerShareRows(supabase, ownerId)

  if (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Share Token API] Error listing owner share tokens: ${error.message}`,
      endpoint: '/api/documents/share-token',
      metadata: {
        operation: 'list_owner',
        code: error.code ?? null,
      },
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const activeTokens = (data ?? [])
    .map((token) => withLegacyShareTokenDefaults(token))
    .filter((token) => isActiveShareToken(token))

  if (activeTokens.length === 0) {
    return NextResponse.json({ tokens: [] })
  }

  const documentIds = [...new Set(activeTokens.map((token) => token.document_id))]
  const trustedPersonIds = [...new Set(activeTokens.map((token) => token.trusted_person_id))]

  let documentsById = new Map<string, OwnerShareDocumentRow>()
  if (documentIds.length > 0) {
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('id, title, category, file_name')
      .in('id', documentIds)
      .eq('user_id', ownerId)

    if (documentsError) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: '[Share Token API] Unable to hydrate owner share documents',
        endpoint: '/api/documents/share-token',
        metadata: {
          operation: 'list_owner_documents',
          code: documentsError.code ?? null,
          message: documentsError.message,
          ownerId,
        },
      })
    } else {
      documentsById = new Map(
        (documents ?? []).map((document) => [document.id, document as OwnerShareDocumentRow])
      )
    }
  }

  let trustedPersonsById = new Map<string, OwnerTrustedPersonRow>()
  if (trustedPersonIds.length > 0) {
    const { data: trustedPersons, error: trustedPersonsError } = await supabase
      .from('trusted_persons')
      .select('id, name, email')
      .in('id', trustedPersonIds)
      .eq('user_id', ownerId)

    if (trustedPersonsError) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: '[Share Token API] Unable to hydrate owner trusted-person metadata',
        endpoint: '/api/documents/share-token',
        metadata: {
          operation: 'list_owner_trusted_persons',
          code: trustedPersonsError.code ?? null,
          message: trustedPersonsError.message,
          ownerId,
        },
      })
    } else {
      trustedPersonsById = new Map(
        (trustedPersons ?? []).map((trustedPerson) => [trustedPerson.id, trustedPerson as OwnerTrustedPersonRow])
      )
    }
  }

  let relationshipKeyPairs = new Set<string>()
  try {
    relationshipKeyPairs = await fetchRelationshipKeyPairSet(
      supabase,
      activeTokens.map((token) => ({
        ownerId,
        trustedPersonId: token.trusted_person_id,
      }))
    )
  } catch (relationshipKeyError: any) {
    emitStructuredWarn({
      event_type: 'api',
      event_message: '[Share Token API] Unable to hydrate owner access-link readiness',
      endpoint: '/api/documents/share-token',
      metadata: {
        operation: 'list_owner_access_link_status',
        message: relationshipKeyError?.message ?? String(relationshipKeyError),
        ownerId,
      },
    })
  }

  const tokens: OwnerShareTokenRow[] = activeTokens.map((token) => ({
    ...token,
    documents: documentsById.get(token.document_id) ?? null,
    trusted_persons: trustedPersonsById.get(token.trusted_person_id) ?? null,
    access_link_setup: buildManualAccessLinkGuidance(
      hasRelationshipKeyForPair(relationshipKeyPairs, ownerId, token.trusted_person_id),
      true
    ),
  }))

  return NextResponse.json({ tokens })
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
  }

  const { data: shareToken } = await supabase
    .from('document_share_tokens')
    .select('id, owner_id')
    .eq('id', id)
    .maybeSingle()

  if (!shareToken || shareToken.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let { error } = await supabase
    .from('document_share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)

  if (isLegacyShareTokenSchemaError(error)) {
    emitStructuredWarn({
      event_type: 'api',
      event_message: '[Share Token API] Falling back to legacy share-token schema for revoke',
      endpoint: '/api/documents/share-token',
      metadata: {
        operation: 'revoke',
        code: error?.code ?? null,
        message: error?.message ?? null,
      },
    })

    ;({ error } = await supabase
      .from('document_share_tokens')
      .delete()
      .eq('id', id))
  }

  if (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Share Token API] Error revoking share token: ${error.message}`,
      endpoint: '/api/documents/share-token',
      metadata: {
        operation: 'revoke',
        code: error.code ?? null,
      },
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
