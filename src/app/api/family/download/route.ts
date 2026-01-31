import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getFamilyPermissions } from '@/lib/permissions/family-permissions'

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

    // Check family permissions using the new centralized logic
    const permissions = await getFamilyPermissions(user.id, ownerId)

    // If not owner and not a family member with view access
    if (!permissions.isOwner && !permissions.canView) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für diesen Download' },
        { status: 403 }
      )
    }

    // If family member (not owner), check download permission based on subscription
    if (!permissions.isOwner && !permissions.canDownload) {
      return NextResponse.json(
        { 
          error: 'Download erfordert Premium-Abonnement des Besitzers',
          code: 'PREMIUM_REQUIRED'
        },
        { status: 403 }
      )
    }

    // Get owner profile
    const { data: ownerProfile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', ownerId)
      .single()

    const ownerName = ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner'

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

    // Download each document and add to ZIP
    for (const doc of documents) {
      try {
        const { data: fileData, error: fileError } = await adminClient.storage
          .from('documents')
          .download(doc.file_path)

        if (fileError || !fileData) {
          console.error(`Error downloading file ${doc.file_path}:`, fileError)
          continue
        }

        const categoryFolder = CATEGORY_NAMES[doc.category] || doc.category
        const filePath = `${categoryFolder}/${doc.file_name}`
        
        // Stream file data instead of buffering
        const arrayBuffer = await fileData.arrayBuffer()
        zip.file(filePath, arrayBuffer, { compression: 'STORE' })
      } catch (err) {
        console.error(`Error processing document ${doc.id}:`, err)
        continue
      }
    }

    // Generate ZIP with streaming (no large buffers)
    const zipBlob = await zip.generateAsync({ 
      type: 'arraybuffer',
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // Create safe filename - include count for multi-select
    const safeOwnerName = ownerName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const docCount = documents.length
    const filename = documentIds 
      ? `Dokumente_${safeOwnerName}_${dateStr}_${docCount}files.zip`
      : `Lebensordner_${safeOwnerName}_${dateStr}.zip`

    // Return ZIP file
    return new NextResponse(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
