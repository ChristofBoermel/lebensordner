import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { canAccessUserDocuments } from '@/lib/permissions/family-permissions'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    // Get ownerId from query params
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')
    const documentIdsParam = searchParams.get('documentIds')
    const documentIds = documentIdsParam ? documentIdsParam.split(',') : null

    if (!ownerId) {
      return NextResponse.json({ error: 'Benutzer-ID fehlt' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()

    // Check if current user has permission to access owner's documents
    const accessResult = await canAccessUserDocuments(user.id, ownerId)

    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für diesen Download' },
        { status: 403 }
      )
    }

    const ownerName = accessResult.ownerName || 'Lebensordner'

    // Fetch documents - either selected ones or all
    let documentsQuery = adminClient
      .from('documents')
      .select('*')
      .eq('user_id', ownerId)

    // Filter by selected document IDs if provided
    if (documentIds && documentIds.length > 0) {
      documentsQuery = documentsQuery.in('id', documentIds)
    }

    const { data: documents, error: docsError } = await documentsQuery
      .order('category')
      .order('title')

    if (docsError) {
      console.error('Error fetching documents:', docsError)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'Keine Dokumente zum Herunterladen vorhanden' },
        { status: 404 }
      )
    }

    // Import JSZip dynamically for streaming support
    const { default: JSZip } = await import('jszip')

    // Create ZIP file with streaming
    const zip = new JSZip()
    const zipStream = zip.generateNodeStream({
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // Category name mapping
    const CATEGORY_NAMES: Record<string, string> = {
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

    // Process each document
    for (const doc of documents) {
      try {
        // Use stream for reading from Storage if possible (Supabase download returns a Blob/File)
        // For Supabase client, download() returns { data: Blob | null, error: StorageError | null }
        // We can convert Blob to Node Stream
        const { data: fileData, error: fileError } = await adminClient.storage
          .from('documents')
          .download(doc.file_path)

        if (fileError || !fileData) {
          console.error(`Error downloading file ${doc.file_path}:`, fileError)
          continue
        }

        const categoryFolder = CATEGORY_NAMES[doc.category] || doc.category
        const zipPath = `${categoryFolder}/${doc.file_name}`

        // JSZip file() can take a Promise<ArrayBuffer> or Stream
        // Using arrayBuffer() is okay for single files usually, but we keep streamFiles: true
        const buffer = await fileData.arrayBuffer()
        zip.file(zipPath, buffer, { binary: true })
      } catch (err) {
        console.error(`Error processing document ${doc.id}:`, err)
        continue
      }
    }

    // Generate ZIP as a stream
    // Next.js Route Handlers work with Web Streams
    const nodeStream = zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // Convert Node.js Readable stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err) => controller.error(err))
      },
      cancel() {
        if ('destroy' in nodeStream) {
          (nodeStream as any).destroy()
        }
      }
    })

    // Create safe filename
    const safeOwnerName = ownerName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const docCount = documents.length
    const filename = documentIds
      ? `Dokumente_${safeOwnerName}_${dateStr}_${docCount}files.zip`
      : `Lebensordner_${safeOwnerName}_${dateStr}.zip`

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Cache-Control': 'no-cache',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error: any) {
    console.error('Family download error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
