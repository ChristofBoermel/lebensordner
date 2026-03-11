import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isActiveShareToken } from '@/lib/security/share-token-status'
import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from '@/lib/security/share-token-compat'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

type ReceivedShareRow = {
  id: string
  document_id: string
  owner_id: string
  wrapped_dek_for_tp: string
  expires_at?: string | null
  permission?: string
  revoked_at?: string | null
  documents:
    | { id: string; title: string; category: string; file_name: string; file_iv: string | null; file_type: string | null }
    | { id: string; title: string; category: string; file_name: string; file_iv: string | null; file_type: string | null }[]
    | null
  profiles:
    | { full_name: string | null; first_name: string | null; last_name: string | null }
    | { full_name: string | null; first_name: string | null; last_name: string | null }[]
    | null
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trustedPersons, error: trustedPersonsError } = await supabase
    .from('trusted_persons')
    .select('id')
    .eq('linked_user_id', user.id)

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

  let data: ReceivedShareRow[] | null = null
  let error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null = null

  {
    const result = await supabase
      .from('document_share_tokens')
      .select('id, document_id, owner_id, wrapped_dek_for_tp, expires_at, permission, revoked_at, documents(id, title, category, file_name, file_iv, file_type), profiles!owner_id(full_name, first_name, last_name)')
      .in('trusted_person_id', trustedPersonIds)

    data = (result.data ?? null) as ReceivedShareRow[] | null
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
      .select('id, document_id, owner_id, wrapped_dek_for_tp, documents(id, title, category, file_name, file_iv, file_type), profiles!owner_id(full_name, first_name, last_name)')
      .in('trusted_person_id', trustedPersonIds)

    data = (legacyResult.data ?? null) as ReceivedShareRow[] | null
    error = legacyResult.error
  }

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

  const shares = (data ?? [])
    .map((share) => withLegacyShareTokenDefaults(share))
    .filter((share) => isActiveShareToken(share))

  return NextResponse.json({ shares })
}
