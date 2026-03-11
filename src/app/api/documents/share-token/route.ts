import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isActiveShareToken } from '@/lib/security/share-token-status'
import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from '@/lib/security/share-token-compat'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

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

  let { data, error } = await supabase
    .from('document_share_tokens')
    .select(`
      id,
      document_id,
      trusted_person_id,
      wrapped_dek_for_tp,
      expires_at,
      permission,
      revoked_at,
      created_at,
      documents!inner(id, title, category, file_name),
      trusted_persons!inner(id, name, email)
    `)
    .eq('owner_id', ownerId)

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

    ;({ data, error } = await supabase
      .from('document_share_tokens')
      .select(`
        id,
        document_id,
        trusted_person_id,
        wrapped_dek_for_tp,
        created_at,
        documents!inner(id, title, category, file_name),
        trusted_persons!inner(id, name, email)
      `)
      .eq('owner_id', ownerId))
  }

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

  const tokens = (data ?? [])
    .map((token) => withLegacyShareTokenDefaults(token))
    .filter((token) => isActiveShareToken(token))

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
