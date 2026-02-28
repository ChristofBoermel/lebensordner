import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { logSecurityEvent, EVENT_DOWNLOAD_LINK_VIEWED } from '@/lib/security/audit-log'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const token = params.token

    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()

    // Find the download token
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

    // Check if this is a view-only link
    if (downloadToken.link_type === 'view') {
      return NextResponse.json(
        { error: 'Dieser Link ist nur zum Ansehen. Download ist nur mit Premium-Abo verfügbar.' },
        { status: 403 }
      )
    }

    // Check if token has expired
    if (new Date(downloadToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Dieser Link ist abgelaufen' },
        { status: 410 }
      )
    }

    // Check if token was already used
    if (downloadToken.used_at) {
      return NextResponse.json(
        { error: 'Dieser Link wurde bereits verwendet' },
        { status: 410 }
      )
    }

    const { data: wrappedDekRows, error: wrappedDekError } = await adminClient
      .from('download_link_wrapped_deks')
      .select('id')
      .eq('download_token_id', downloadToken.id)
      .limit(1)

    if (wrappedDekError) {
      console.error('Error checking wrapped DEKs:', wrappedDekError)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    if (wrappedDekRows && wrappedDekRows.length > 0) {
      return NextResponse.json({ requiresClientDecryption: true }, { status: 200 })
    }

    // Get user profile for folder naming
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', downloadToken.user_id)
      .single()

    const userName = profile?.full_name || profile?.email || 'Lebensordner'

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
      .select('*')
      .order('category')
      .order('title')

    let snapshotIds: string[] | null = null

    if (snapshotRows && snapshotRows.length > 0) {
      snapshotIds = snapshotRows.map((row) => row.document_id)
      documentsQuery = documentsQuery.in('id', snapshotIds)
    } else {
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
          { error: 'Dieser Link unterstützt keine verschlüsselten Dokumente. Bitte bitten Sie den Absender, einen neuen Link zu erstellen.' },
          { status: 409 }
        )
      }

      documentsQuery = documentsQuery.eq('user_id', downloadToken.user_id)
    }

    const { data: documents, error: docsError } = await documentsQuery

    if (docsError) {
      console.error('Error fetching documents:', docsError)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    let orderedDocuments = documents || []

    if (snapshotIds && orderedDocuments.length > 0) {
      const indexById = new Map(snapshotIds.map((id, index) => [id, index]))
      orderedDocuments = [...orderedDocuments].sort((a, b) => {
        const indexA = indexById.get(a.id) ?? 0
        const indexB = indexById.get(b.id) ?? 0
        return indexA - indexB
      })
    }

    if (!orderedDocuments || orderedDocuments.length === 0) {
      return NextResponse.json(
        { error: 'Keine Dokumente zum Herunterladen vorhanden' },
        { status: 404 }
      )
    }

    // Create ZIP file
    const zip = new JSZip()

    // Category name mapping
    const categoryNames: Record<string, string> = {
      identitaet: 'Identität',
      finanzen: 'Finanzen',
      versicherungen: 'Versicherungen',
      wohnen: 'Wohnen',
      gesundheit: 'Gesundheit',
      vertraege: 'Verträge',
      rente: 'Rente & Pension',
      familie: 'Familie',
      arbeit: 'Arbeit',
      religion: 'Religion',
      sonstige: 'Sonstige',
    }

    // Download each document and add to ZIP
    for (const doc of orderedDocuments) {
      try {
        // Get file from storage
        const { data: fileData, error: fileError } = await adminClient.storage
          .from('documents')
          .download(doc.file_path)

        if (fileError || !fileData) {
          console.error(`Error downloading file ${doc.file_path}:`, fileError)
          continue
        }

        // Create folder structure: Category/Filename
        const categoryFolder = categoryNames[doc.category] || doc.category
        const filePath = `${categoryFolder}/${doc.file_name}`

        // Add file to ZIP
        const arrayBuffer = await fileData.arrayBuffer()
        zip.file(filePath, arrayBuffer)
      } catch (err) {
        console.error(`Error processing document ${doc.id}:`, err)
        continue
      }
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'arraybuffer' })

    // Log security event for download link access
    logSecurityEvent({
      user_id: downloadToken.user_id,
      event_type: EVENT_DOWNLOAD_LINK_VIEWED,
      event_data: {
        owner_id: downloadToken.user_id,
        recipient_email: downloadToken.recipient_email,
        document_count: orderedDocuments?.length || 0,
        download_link_token: token,
        link_type: 'download',
      },
      request: request as NextRequest,
    })

    // Mark token as used
    await adminClient
      .from('download_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', downloadToken.id)

    // Create safe filename
    const safeUserName = userName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `Lebensordner_${safeUserName}_${dateStr}.zip`

    // Return ZIP file
    return new NextResponse(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
