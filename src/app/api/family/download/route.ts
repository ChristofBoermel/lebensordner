import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { canAccessUserDocuments } from '@/lib/permissions/family-permissions'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    // Get ownerId from query params
    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')

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

    // Get all documents for the owner
    const { data: documents, error: docsError } = await adminClient
      .from('documents')
      .select('*')
      .eq('user_id', ownerId)
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
    for (const doc of documents) {
      try {
        const { data: fileData, error: fileError } = await adminClient.storage
          .from('documents')
          .download(doc.file_path)

        if (fileError || !fileData) {
          console.error(`Error downloading file ${doc.file_path}:`, fileError)
          continue
        }

        const categoryFolder = categoryNames[doc.category] || doc.category
        const filePath = `${categoryFolder}/${doc.file_name}`
        const arrayBuffer = await fileData.arrayBuffer()
        zip.file(filePath, arrayBuffer)
      } catch (err) {
        console.error(`Error processing document ${doc.id}:`, err)
        continue
      }
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'arraybuffer' })

    // Create safe filename
    const safeOwnerName = ownerName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `Lebensordner_${safeOwnerName}_${dateStr}.zip`

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
