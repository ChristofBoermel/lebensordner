import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getFamilyPermissions } from '@/lib/permissions/family-permissions'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/family/documents/download-url
 * 
 * Returns a signed URL for downloading a specific document.
 * Permission check:
 * - Owner can always download (existing behavior)
 * - Family members can download only if owner has Premium subscription
 * 
 * Body: { documentId: string, ownerId: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { documentId, ownerId } = await request.json()

    if (!documentId || !ownerId) {
      return NextResponse.json(
        { error: 'Dokument-ID und Benutzer-ID erforderlich' },
        { status: 400 }
      )
    }

    const adminClient = getSupabaseAdmin()

    // Check family permissions
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

    // Get document metadata
    const { data: document, error: docError } = await adminClient
      .from('documents')
      .select('id, file_path, file_name, user_id')
      .eq('id', documentId)
      .eq('user_id', ownerId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Dokument nicht gefunden' },
        { status: 404 }
      )
    }

    // Generate signed URL (valid for 5 minutes)
    const { data: signedUrl, error: urlError } = await adminClient.storage
      .from('documents')
      .createSignedUrl(document.file_path, 300)

    if (urlError || !signedUrl) {
      console.error('Error generating signed URL:', urlError)
      return NextResponse.json(
        { error: 'Fehler beim Erstellen des Download-Links' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      signedUrl: signedUrl.signedUrl,
      fileName: document.file_name,
      expiresIn: 300,
    })
  } catch (error: any) {
    console.error('Download URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
