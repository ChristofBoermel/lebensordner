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

    const adminClient = getSupabaseAdmin()

    // Check if current user is linked as a trusted person for the owner
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

    // Get owner profile with subscription info
    const { data: ownerProfile } = await adminClient
      .from('profiles')
      .select('full_name, email, subscription_status, stripe_price_id')
      .eq('id', ownerId)
      .single()

    // Check owner's tier - view is allowed for basic and premium
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

    const ownerName = ownerProfile?.full_name || ownerProfile?.email || 'Unbekannt'

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
