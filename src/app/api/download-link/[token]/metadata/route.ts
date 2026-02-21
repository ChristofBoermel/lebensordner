import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ENCRYPTED_LINK_ERROR = 'Dieser Link unterstützt keine verschlüsselten Dokumente. Bitte bitten Sie den Absender, einen neuen Link zu erstellen.'

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const token = params.token

    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()

    const { data: downloadToken, error: tokenError } = await adminClient
      .from('download_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !downloadToken) {
      return NextResponse.json(
        { error: 'Ungültiger oder abgelaufener Link' },
        { status: 404 }
      )
    }

    if (new Date(downloadToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Dieser Link ist abgelaufen' },
        { status: 410 }
      )
    }

    if (downloadToken.link_type !== 'view' && downloadToken.used_at) {
      return NextResponse.json(
        { error: 'Dieser Link wurde bereits verwendet' },
        { status: 410 }
      )
    }

    const { data: snapshotRows, error: snapshotError } = await adminClient
      .from('download_link_documents')
      .select('document_id')
      .eq('download_token_id', downloadToken.id)

    if (snapshotError) {
      console.error('Error fetching download link documents:', snapshotError)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    let documentsQuery = adminClient
      .from('documents')
      .select('id, category, file_type, is_encrypted, file_path')

    if (!snapshotRows || snapshotRows.length === 0) {
      const { data: encryptedDocument, error: encryptedDocumentError } = await adminClient
        .from('documents')
        .select('id')
        .eq('user_id', downloadToken.user_id)
        .eq('is_encrypted', true)
        .limit(1)
        .maybeSingle()

      if (encryptedDocumentError) {
        console.error('Error checking encrypted documents:', encryptedDocumentError)
        return NextResponse.json(
          { error: 'Fehler beim Laden der Dokumente' },
          { status: 500 }
        )
      }

      if (encryptedDocument) {
        return NextResponse.json(
          { error: ENCRYPTED_LINK_ERROR },
          { status: 409 }
        )
      }

      documentsQuery = documentsQuery.eq('user_id', downloadToken.user_id)
    } else {
      const snapshotIds = snapshotRows.map((row) => row.document_id)
      documentsQuery = documentsQuery
        .in('id', snapshotIds)
        .eq('user_id', downloadToken.user_id)
    }

    const { data: documents, error: documentsError } = await documentsQuery

    if (documentsError) {
      console.error('Error fetching documents:', documentsError)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'Keine Dokumente vorhanden' },
        { status: 404 }
      )
    }

    const { data: wrappedDeks, error: wrappedDeksError } = await adminClient
      .from('download_link_wrapped_deks')
      .select('document_id, wrapped_dek_for_share, file_iv, file_name_encrypted')
      .eq('download_token_id', downloadToken.id)

    if (wrappedDeksError) {
      console.error('Error fetching wrapped DEKs:', wrappedDeksError)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    const wrappedDekMap = new Map(
      (wrappedDeks || []).map((row) => [
        row.document_id,
        {
          wrappedDekForShare: row.wrapped_dek_for_share,
          fileIv: row.file_iv,
          fileNameEncrypted: row.file_name_encrypted,
        },
      ])
    )

    const requiresClientDecryption = (wrappedDeks || []).length > 0

    const documentsWithSignedUrls = await Promise.all(
      documents.map(async (doc) => {
        const { data: signedData, error: signedError } = await adminClient.storage
          .from('documents')
          .createSignedUrl(doc.file_path, 300)

        if (signedError || !signedData?.signedUrl) {
          console.error('Error creating signed URL:', signedError)
          return null
        }

        const wrappedInfo = wrappedDekMap.get(doc.id)

        return {
          id: doc.id,
          category: doc.category,
          file_type: doc.file_type,
          is_encrypted: doc.is_encrypted,
          signedUrl: signedData.signedUrl,
          ...(wrappedInfo
            ? {
              wrappedDekForShare: wrappedInfo.wrappedDekForShare,
              fileIv: wrappedInfo.fileIv,
              fileNameEncrypted: wrappedInfo.fileNameEncrypted,
            }
            : {}),
        }
      })
    )

    const documentsResult = documentsWithSignedUrls.filter(Boolean)

    if (documentsResult.length === 0) {
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', downloadToken.user_id)
      .single()

    const senderName = profile?.full_name || profile?.email || 'Unbekannt'

    return NextResponse.json({
      requiresClientDecryption,
      senderName,
      linkType: downloadToken.link_type,
      expiresAt: downloadToken.expires_at,
      documents: documentsResult,
    })
  } catch (error: any) {
    console.error('Download metadata error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
