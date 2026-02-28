import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { logSecurityEvent, EVENT_DOWNLOAD_LINK_VIEWED } from '@/lib/security/audit-log'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Secret for signing stream tokens (uses service role key as base)
const getTokenSecret = () => {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHmac('sha256', 'download-link-view-secret').update(base).digest()
}

interface DownloadLinkStreamToken {
  docId: string
  ownerId: string
  downloadToken: string
  exp: number
}

function verifyStreamToken(token: string): DownloadLinkStreamToken | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, signature } = decoded

    const expectedSignature = createHmac('sha256', getTokenSecret()).update(data).digest('hex')
    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }

    const payload: DownloadLinkStreamToken = JSON.parse(data)

    // Check expiry
    if (payload.exp < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const downloadLinkToken = params.token

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')
    const streamToken = searchParams.get('token')

    if (!docId || !streamToken || !downloadLinkToken) {
      return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
    }

    // Verify the stream token
    const tokenPayload = verifyStreamToken(streamToken)
    if (!tokenPayload) {
      return NextResponse.json({ error: 'Token ungültig oder abgelaufen' }, { status: 403 })
    }

    // Verify token matches request
    if (tokenPayload.docId !== docId || tokenPayload.downloadToken !== downloadLinkToken) {
      return NextResponse.json({ error: 'Token stimmt nicht überein' }, { status: 403 })
    }

    const adminClient = getSupabaseAdmin()

    // Verify the download token is still valid
    const { data: downloadToken, error: tokenError } = await adminClient
      .from('download_tokens')
      .select('*')
      .eq('token', downloadLinkToken)
      .single()

    if (tokenError || !downloadToken) {
      return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
    }

    // Check if token has expired
    if (new Date(downloadToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Dieser Link ist abgelaufen' }, { status: 410 })
    }

    // Check if this is a view link
    if (downloadToken.link_type !== 'view') {
      return NextResponse.json({ error: 'Dieser Link ist für Download, nicht für Ansicht' }, { status: 400 })
    }

    // Verify owner matches
    if (tokenPayload.ownerId !== downloadToken.user_id) {
      return NextResponse.json({ error: 'Ungültige Berechtigung' }, { status: 403 })
    }

    // Get the document
    const { data: document, error: docError } = await adminClient
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('user_id', downloadToken.user_id)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    // Fetch the file from storage
    const { data: fileData, error: fileError } = await adminClient.storage
      .from('documents')
      .download(document.file_path)

    if (fileError || !fileData) {
      console.error('Error downloading file:', fileError)
      return NextResponse.json({ error: 'Fehler beim Laden der Datei' }, { status: 500 })
    }

    // Log security event for download link stream access
    logSecurityEvent({
      user_id: downloadToken.user_id,
      event_type: EVENT_DOWNLOAD_LINK_VIEWED,
      event_data: {
        owner_id: downloadToken.user_id,
        document_id: docId,
        recipient_email: downloadToken.recipient_email,
        file_type: document.file_type,
        action: 'stream',
        download_link_token: downloadLinkToken,
      },
      request,
    })

    // Get file as array buffer for streaming
    const arrayBuffer = await fileData.arrayBuffer()

    // Determine content type
    const contentType = document.file_type || 'application/octet-stream'

    // Return file with inline disposition (view-only, no download prompt)
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    console.error('Stream error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
