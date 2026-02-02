import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface DocumentMetadata {
  id: string
  title: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  category: string
  subcategory: string | null
  expiry_date: string | null
  notes: string | null
  created_at: string
  streamToken: string | null
}

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

// Secret for signing stream tokens (uses service role key as base)
const getTokenSecret = () => {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHmac('sha256', 'download-link-view-secret').update(base).digest()
}

// Token expiry in milliseconds (5 minutes)
const TOKEN_EXPIRY_MS = 5 * 60 * 1000

export interface DownloadLinkStreamToken {
  docId: string
  ownerId: string
  downloadToken: string
  exp: number
}

export function generateDownloadLinkStreamToken(docId: string, ownerId: string, downloadToken: string): string {
  const payload: DownloadLinkStreamToken = {
    docId,
    ownerId,
    downloadToken,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  }
  const data = JSON.stringify(payload)
  const signature = createHmac('sha256', getTokenSecret()).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, signature })).toString('base64url')
}

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
        { error: 'Ungültiger Link' },
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

    // Check if this is a view link
    if (downloadToken.link_type !== 'view') {
      return NextResponse.json(
        { error: 'Dieser Link ist für Download, nicht für Ansicht' },
        { status: 400 }
      )
    }

    // Note: We don't check used_at for view links - they can be used multiple times

    // Get owner profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', downloadToken.user_id)
      .single()

    const ownerName = profile?.full_name || profile?.email || 'Unbekannt'

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
      return NextResponse.json({
        ownerName,
        ownerTier: 'basic', // View links are only for basic tier
        documents: [],
        categories: categoryNames,
        expiresAt: downloadToken.expires_at,
      })
    }

    // Create stream tokens for each document
    const documentsWithTokens: DocumentMetadata[] = documents.map((doc) => {
      const streamToken = generateDownloadLinkStreamToken(doc.id, downloadToken.user_id, token)

      return {
        id: doc.id,
        title: doc.title,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_type: doc.file_type,
        file_size: doc.file_size,
        category: doc.category,
        subcategory: doc.subcategory,
        expiry_date: doc.expiry_date,
        notes: doc.notes,
        created_at: doc.created_at,
        streamToken,
      }
    })

    return NextResponse.json({
      ownerName,
      ownerTier: 'basic', // View links are only for basic tier
      documents: documentsWithTokens,
      categories: categoryNames,
      expiresAt: downloadToken.expires_at,
    })
  } catch (error: any) {
    console.error('Download link view error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
