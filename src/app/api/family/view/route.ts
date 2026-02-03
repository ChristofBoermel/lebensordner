import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getTierFromSubscription } from '@/lib/subscription-tiers'
import { generateStreamToken } from './stream/route'

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

    console.log('[Family View API] Request from user:', user.id, 'for owner:', ownerId)

    const adminClient = getSupabaseAdmin()

    // Check if current user is linked as a trusted person for the owner
    // First, check if any relationship exists at all
    const { data: anyRelationship, error: anyRelError } = await adminClient
      .from('trusted_persons')
      .select('id, invitation_status, is_active')
      .eq('user_id', ownerId)
      .eq('linked_user_id', user.id)
      .single()

    console.log('[Family View API] Relationship check:', {
      ownerId,
      userId: user.id,
      relationship: anyRelationship,
      error: anyRelError?.message
    })

    // Provide specific error messages based on relationship status
    if (anyRelError || !anyRelationship) {
      return NextResponse.json(
        {
          error: 'Keine Berechtigung für diese Ansicht',
          errorCode: 'NO_RELATIONSHIP',
          details: 'Sie wurden nicht als Vertrauensperson für diesen Benutzer hinzugefügt.'
        },
        { status: 403 }
      )
    }

    if (anyRelationship.invitation_status !== 'accepted') {
      return NextResponse.json(
        {
          error: 'Einladung noch nicht angenommen',
          errorCode: 'INVITATION_PENDING',
          details: `Die Einladung hat den Status: ${anyRelationship.invitation_status}. Bitte nehmen Sie die Einladung zuerst an.`
        },
        { status: 403 }
      )
    }

    if (!anyRelationship.is_active) {
      return NextResponse.json(
        {
          error: 'Zugriff deaktiviert',
          errorCode: 'RELATIONSHIP_INACTIVE',
          details: 'Der Zugriff wurde vom Besitzer deaktiviert.'
        },
        { status: 403 }
      )
    }

    // Get full trusted person data for active, accepted relationship
    const { data: trustedPerson, error: tpError } = await adminClient
      .from('trusted_persons')
      .select('id, name, access_level')
      .eq('user_id', ownerId)
      .eq('linked_user_id', user.id)
      .eq('invitation_status', 'accepted')
      .eq('is_active', true)
      .single()

    if (tpError || !trustedPerson) {
      console.error('[Family View API] Unexpected error fetching trusted person:', tpError)
      return NextResponse.json(
        {
          error: 'Keine Berechtigung für diese Ansicht',
          errorCode: 'PERMISSION_DENIED',
          details: 'Es konnte keine gültige Vertrauensperson-Beziehung gefunden werden.'
        },
        { status: 403 }
      )
    }

    // Get owner profile with subscription info
    const { data: ownerProfile, error: ownerError } = await adminClient
      .from('profiles')
      .select('full_name, email, subscription_status, stripe_price_id')
      .eq('id', ownerId)
      .single()

    if (ownerError || !ownerProfile) {
      console.error('[Family View API] Error fetching owner profile:', ownerError)
      return NextResponse.json(
        {
          error: 'Besitzer nicht gefunden',
          errorCode: 'OWNER_NOT_FOUND',
          details: 'Das Profil des Besitzers konnte nicht gefunden werden.'
        },
        { status: 404 }
      )
    }

    // Check owner's tier - view is allowed for basic and premium
    const ownerTier = getTierFromSubscription(
      ownerProfile.subscription_status || null,
      ownerProfile.stripe_price_id || null
    )

    console.log('[Family View API] Owner tier:', ownerTier.id, 'for owner:', ownerId)

    // Only allow view for basic or premium tiers (not free)
    if (ownerTier.id === 'free') {
      return NextResponse.json(
        {
          error: 'Der Besitzer hat ein kostenloses Abo. Ansicht ist nur mit einem kostenpflichtigen Abo verfügbar.',
          errorCode: 'FREE_TIER',
          details: 'Der Besitzer muss ein Basis- oder Premium-Abo haben, damit Sie die Dokumente einsehen können.',
          requiredTier: 'basic'
        },
        { status: 403 }
      )
    }

    const ownerName = ownerProfile.full_name || ownerProfile.email || 'Unbekannt'

    // Get all documents for the owner
    console.log('[Family View API] Fetching documents for owner:', ownerId)
    const { data: documents, error: docsError } = await adminClient
      .from('documents')
      .select('*')
      .eq('user_id', ownerId)
      .order('category')
      .order('title')

    if (docsError) {
      console.error('[Family View API] Error fetching documents:', {
        error: docsError.message,
        code: docsError.code,
        details: docsError.details,
        ownerId,
        userId: user.id
      })
      return NextResponse.json(
        {
          error: 'Fehler beim Laden der Dokumente',
          errorCode: 'DOCUMENTS_FETCH_ERROR',
          details: 'Die Dokumente konnten nicht geladen werden. Bitte versuchen Sie es später erneut.'
        },
        { status: 500 }
      )
    }

    console.log('[Family View API] Documents fetched:', documents?.length || 0)

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        ownerName,
        ownerTier: ownerTier.id,
        documents: [],
        categories: categoryNames,
      })
    }

    // Create stream tokens for each document (no direct signed URLs)
    const documentsWithTokens: DocumentMetadata[] = documents.map((doc) => {
      // Generate a short-lived stream token for secure viewing
      const streamToken = generateStreamToken(doc.id, ownerId, user.id)

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
      ownerTier: ownerTier.id,
      documents: documentsWithTokens,
      categories: categoryNames,
    })
  } catch (error: any) {
    console.error('Family view error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
