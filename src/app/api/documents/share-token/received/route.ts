import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { isActiveShareToken } from '@/lib/security/share-token-status'
import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from '@/lib/security/share-token-compat'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

type ShareTokenError = {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}

type ReceivedShareBaseRow = {
  id: string
  document_id: string
  owner_id: string
  trusted_person_id: string
  wrapped_dek_for_tp: string
  expires_at?: string | null
  permission?: string
  revoked_at?: string | null
}

type ReceivedShareDocumentRow = {
  id: string
  title: string
  category: string
  file_name: string
  file_iv: string | null
  file_type: string | null
}

type ReceivedShareProfileRow = {
  full_name: string | null
  first_name: string | null
  last_name: string | null
}

type ReceivedShareRow = ReceivedShareBaseRow & {
  documents: ReceivedShareDocumentRow | null
  profiles: ReceivedShareProfileRow | null
}

function createMissingDocumentFallback(documentId: string): ReceivedShareDocumentRow {
  return {
    id: documentId,
    title: 'Unbekanntes Dokument',
    category: 'sonstige',
    file_name: 'unbekannt',
    file_iv: null,
    file_type: null,
  }
}

function createMissingProfileFallback(): ReceivedShareProfileRow {
  return {
    full_name: null,
    first_name: null,
    last_name: null,
  }
}

async function fetchReceivedShareRows(
  supabase: { from: (table: string) => any },
  trustedPersonIds: string[]
) {
  let data: ReceivedShareBaseRow[] | null = null
  let error: ShareTokenError | null = null

  {
    const result = await supabase
      .from('document_share_tokens')
      .select('id, document_id, owner_id, trusted_person_id, wrapped_dek_for_tp, expires_at, permission, revoked_at')
      .in('trusted_person_id', trustedPersonIds)

    data = (result.data ?? null) as ReceivedShareBaseRow[] | null
    error = result.error
  }

  if (isLegacyShareTokenSchemaError(error)) {
    emitStructuredWarn({
      event_type: 'api',
      event_message: '[Received Share Token API] Falling back to legacy share-token schema for recipient list',
      endpoint: '/api/documents/share-token/received',
      metadata: {
        operation: 'list_received',
        code: error?.code ?? null,
        message: error?.message ?? null,
      },
    })

    const legacyResult = await supabase
      .from('document_share_tokens')
      .select('id, document_id, owner_id, trusted_person_id, wrapped_dek_for_tp')
      .in('trusted_person_id', trustedPersonIds)

    data = (legacyResult.data ?? null) as ReceivedShareBaseRow[] | null
    error = legacyResult.error
  }

  return { data, error }
}

function getSupabaseAdmin() {
  return createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const user = await resolveAuthenticatedUser(
    supabase,
    request,
    '/api/documents/share-token/received'
  )

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = getSupabaseAdmin()

  const { data: trustedPersons, error: trustedPersonsError } = await adminClient
    .from('trusted_persons')
    .select('id')
    .eq('linked_user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)

  if (trustedPersonsError) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Received Share Token API] Error fetching trusted persons: ${trustedPersonsError.message}`,
      endpoint: '/api/documents/share-token/received',
      metadata: {
        operation: 'list_received_trusted_persons',
        code: trustedPersonsError.code ?? null,
      },
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const trustedPersonIds = (trustedPersons ?? []).map((tp) => tp.id)

  if (trustedPersonIds.length === 0) {
    return NextResponse.json({ shares: [] })
  }

  const { data, error } = await fetchReceivedShareRows(adminClient, trustedPersonIds)

  if (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `[Received Share Token API] Error listing received shares: ${error.message}`,
      endpoint: '/api/documents/share-token/received',
      metadata: {
        operation: 'list_received',
        code: error.code ?? null,
      },
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const activeShares = (data ?? [])
    .map((share) => withLegacyShareTokenDefaults(share))
    .filter((share) => isActiveShareToken(share))

  if (activeShares.length === 0) {
    return NextResponse.json({ shares: [] })
  }

  const documentIds = [...new Set(activeShares.map((share) => share.document_id))]
  const ownerIds = [...new Set(activeShares.map((share) => share.owner_id))]

  let documentsById = new Map<string, ReceivedShareDocumentRow>()
  if (documentIds.length > 0) {
    const { data: documents, error: documentsError } = await adminClient
      .from('documents')
      .select('id, title, category, file_name, file_iv, file_type')
      .in('id', documentIds)

    if (documentsError) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: '[Received Share Token API] Unable to hydrate shared document metadata',
        endpoint: '/api/documents/share-token/received',
        metadata: {
          operation: 'list_received_documents',
          code: documentsError.code ?? null,
          message: documentsError.message,
        },
      })
    } else {
      documentsById = new Map(
        (documents ?? []).map((document) => [document.id, document as ReceivedShareDocumentRow])
      )
    }
  }

  let profilesByOwnerId = new Map<string, ReceivedShareProfileRow>()
  if (ownerIds.length > 0) {
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, first_name, last_name')
      .in('id', ownerIds)

    if (profilesError) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: '[Received Share Token API] Unable to hydrate sharer profile metadata',
        endpoint: '/api/documents/share-token/received',
        metadata: {
          operation: 'list_received_profiles',
          code: profilesError.code ?? null,
          message: profilesError.message,
        },
      })
    } else {
      profilesByOwnerId = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          {
            full_name: profile.full_name,
            first_name: profile.first_name,
            last_name: profile.last_name,
          },
        ])
      )
    }
  }

  const shares: ReceivedShareRow[] = activeShares.map((share) => ({
    ...share,
    documents: documentsById.get(share.document_id) ?? createMissingDocumentFallback(share.document_id),
    profiles: profilesByOwnerId.get(share.owner_id) ?? createMissingProfileFallback(),
  }))

  return NextResponse.json({ shares })
}
