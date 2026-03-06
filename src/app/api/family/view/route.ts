import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getTierFromSubscription } from '@/lib/subscription-tiers'
import { generateStreamToken } from './stream/route'
import { logSecurityEvent, EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED } from '@/lib/security/audit-log'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { guardTrustedPersonAccess } from '@/lib/security/trusted-person-guard'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
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
    const user = await resolveAuthenticatedUser(supabase, request, '/api/family/view')

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

    const guard = await guardTrustedPersonAccess(adminClient, ownerId, user.id, 'view')
    if (!guard.allowed || !guard.trustedPerson) {
      return NextResponse.json(
        {
          error: 'Keine Berechtigung für diese Ansicht',
          errorCode: guard.errorCode ?? 'PERMISSION_DENIED',
          details: guard.details ?? 'Es konnte keine gültige Vertrauensperson-Beziehung gefunden werden.',
        },
        { status: 403 }
      )
    }
    const trustedPerson = guard.trustedPerson

    // Get owner profile with subscription info
    const { data: ownerProfile, error: ownerError } = await adminClient
      .from('profiles')
      .select('full_name, email, subscription_status, stripe_price_id')
      .eq('id', ownerId)
      .single()

    if (ownerError || !ownerProfile) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Family View API] Error fetching owner profile: ${ownerError?.message ?? 'not found'}`,
        endpoint: '/api/family/view',
      })
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
    const { data: documents, error: docsError } = await adminClient
      .from('documents')
      .select('*')
      .eq('user_id', ownerId)
      .order('category')
      .order('title')

    if (docsError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Family View API] Error fetching documents: ${docsError.message}`,
        endpoint: '/api/family/view',
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

    if (!documents || documents.length === 0) {
      logSecurityEvent({
        user_id: ownerId,
        event_type: EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED,
        event_data: {
          owner_id: ownerId,
          trusted_person_id: trustedPerson.id,
          trusted_person_user_id: user.id,
          document_count: 0,
          access_level: trustedPerson.access_level,
        },
        request: request as NextRequest,
      })

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

    // Log security event for trusted person document view
    logSecurityEvent({
      user_id: ownerId,
      event_type: EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED,
      event_data: {
        owner_id: ownerId,
        trusted_person_id: trustedPerson.id,
        trusted_person_user_id: user.id,
        document_count: documentsWithTokens.length,
        access_level: trustedPerson.access_level,
      },
      request: request as NextRequest,
    })

    return NextResponse.json({
      ownerName,
      ownerTier: ownerTier.id,
      documents: documentsWithTokens,
      categories: categoryNames,
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Family view error: ${error?.message ?? String(error)}`,
      endpoint: '/api/family/view',
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
