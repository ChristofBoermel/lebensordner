import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isActiveShareToken } from '@/lib/security/share-token-status'
import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from '@/lib/security/share-token-compat'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

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

  let { data, error } = await supabase
    .from('document_share_tokens')
    .select('id, document_id, owner_id, wrapped_dek_for_tp, expires_at, permission, revoked_at, documents(id, title, category, file_name, file_iv, file_type), profiles!owner_id(full_name, first_name, last_name)')
    .in('trusted_person_id', trustedPersonIds)

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

    ;({ data, error } = await supabase
      .from('document_share_tokens')
      .select('id, document_id, owner_id, wrapped_dek_for_tp, documents(id, title, category, file_name, file_iv, file_type), profiles!owner_id(full_name, first_name, last_name)')
      .in('trusted_person_id', trustedPersonIds))
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
