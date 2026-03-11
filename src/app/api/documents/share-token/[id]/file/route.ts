import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from '@/lib/security/share-token-compat'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const adminClient = createClient(
      process.env['SUPABASE_URL']!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: trustedPersons, error: tpError } = await adminClient
      .from('trusted_persons')
      .select('id')
      .eq('linked_user_id', user.id)
      .eq('invitation_status', 'accepted')

    if (tpError || !trustedPersons || trustedPersons.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const trustedPersonIds = trustedPersons.map((tp: { id: string }) => tp.id)

    let { data: shareToken, error: shareError } = await adminClient
      .from('document_share_tokens')
      .select('id, document_id, revoked_at, expires_at')
      .eq('id', id)
      .in('trusted_person_id', trustedPersonIds)
      .maybeSingle()

    if (isLegacyShareTokenSchemaError(shareError)) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: '[Share Token File API] Falling back to legacy share-token schema for file access',
        endpoint: '/api/documents/share-token/[id]/file',
        metadata: {
          operation: 'fetch_share_file',
          code: shareError?.code ?? null,
          message: shareError?.message ?? null,
        },
      })

      ;({ data: shareToken, error: shareError } = await adminClient
        .from('document_share_tokens')
        .select('id, document_id')
        .eq('id', id)
        .in('trusted_person_id', trustedPersonIds)
        .maybeSingle())
    }

    if (shareError || !shareToken) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const normalizedShareToken = withLegacyShareTokenDefaults(shareToken)

    if (normalizedShareToken.revoked_at !== null) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (normalizedShareToken.expires_at !== null && new Date(normalizedShareToken.expires_at) <= new Date()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: document, error: docError } = await adminClient
      .from('documents')
      .select('file_path')
      .eq('id', normalizedShareToken.document_id)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: fileData, error: fileError } = await adminClient.storage
      .from('documents')
      .download(document.file_path)

    if (fileError || !fileData) {
      return NextResponse.json({ error: 'Fehler beim Laden der Datei' }, { status: 500 })
    }

    return new NextResponse(await fileData.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="encrypted"',
      },
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Share token file error: ${error?.message ?? String(error)}`,
      endpoint: '/api/documents/share-token/[id]/file',
      stack: error?.stack,
    })
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 })
  }
}
