import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Get user profile for folder naming
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', downloadToken.user_id)
      .single()

    const userName = profile?.full_name || profile?.email || 'Lebensordner'

    // Get all documents for the user
    const { data: documents, error: docsError } = await adminClient
      .from('documents')
      .select('*')
      .eq('user_id', downloadToken.user_id)
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
