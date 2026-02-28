import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getTierFromSubscription } from '@/lib/subscription-tiers'
import { createHmac, timingSafeEqual } from 'crypto'
import { logSecurityEvent, EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED } from '@/lib/security/audit-log'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Secret for signing stream tokens (uses service role key as base)
const getTokenSecret = () => {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHmac('sha256', 'view-stream-secret').update(base).digest()
}

// Token expiry in milliseconds (5 minutes)
const TOKEN_EXPIRY_MS = 5 * 60 * 1000

export interface StreamToken {
  docId: string
  ownerId: string
  viewerId: string
  exp: number
}

export function generateStreamToken(docId: string, ownerId: string, viewerId: string): string {
  const payload: StreamToken = {
    docId,
    ownerId,
    viewerId,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  }
  const data = JSON.stringify(payload)
  const signature = createHmac('sha256', getTokenSecret()).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, signature })).toString('base64url')
}

function verifyStreamToken(token: string): StreamToken | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, signature } = decoded

    const expectedSignature = createHmac('sha256', getTokenSecret()).update(data).digest('hex')
    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }

    const payload: StreamToken = JSON.parse(data)

    // Check expiry
    if (payload.exp < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')
    const token = searchParams.get('token')

    if (!docId || !token) {
      return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
    }

    // Verify the stream token
    const tokenPayload = verifyStreamToken(token)
    if (!tokenPayload) {
      return NextResponse.json({ error: 'Token ungültig oder abgelaufen' }, { status: 403 })
    }

    // Verify token matches request
    if (tokenPayload.docId !== docId || tokenPayload.viewerId !== user.id) {
      return NextResponse.json({ error: 'Token stimmt nicht überein' }, { status: 403 })
    }

    const ownerId = tokenPayload.ownerId
    const adminClient = getSupabaseAdmin()

    // Verify trusted person access (re-check at stream time for security)
    const { data: trustedPerson, error: tpError } = await adminClient
      .from('trusted_persons')
      .select('id, name, access_level')
      .eq('user_id', ownerId)
      .eq('linked_user_id', user.id)
      .eq('invitation_status', 'accepted')
      .eq('is_active', true)
      .single()

    if (tpError || !trustedPerson) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für diese Ansicht' },
        { status: 403 }
      )
    }

    // Get owner profile to verify tier
    const { data: ownerProfile } = await adminClient
      .from('profiles')
      .select('subscription_status, stripe_price_id')
      .eq('id', ownerId)
      .single()

    const ownerTier = getTierFromSubscription(
      ownerProfile?.subscription_status || null,
      ownerProfile?.stripe_price_id || null
    )

    // Only allow view for basic or premium tiers (not free)
    if (ownerTier.id === 'free') {
      return NextResponse.json(
        { error: 'Der Besitzer hat ein kostenloses Abo. Ansicht ist nur mit einem kostenpflichtigen Abo verfügbar.' },
        { status: 403 }
      )
    }

    // Get the document
    const { data: document, error: docError } = await adminClient
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('user_id', ownerId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Dokument nicht gefunden' },
        { status: 404 }
      )
    }

    // Fetch the file from storage
    const { data: fileData, error: fileError } = await adminClient.storage
      .from('documents')
      .download(document.file_path)

    if (fileError || !fileData) {
      console.error('Error downloading file:', fileError)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Datei' },
        { status: 500 }
      )
    }

    // Log security event for trusted person document stream
    logSecurityEvent({
      user_id: ownerId,
      event_type: EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED,
      event_data: {
        owner_id: ownerId,
        document_id: docId,
        trusted_person_id: trustedPerson.id,
        trusted_person_user_id: user.id,
        file_type: document.file_type,
        action: 'stream',
      },
      request: request as NextRequest,
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
