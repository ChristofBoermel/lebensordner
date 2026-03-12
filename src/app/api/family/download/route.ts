import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { getTierFromSubscription, allowsFamilyDownloads } from '@/lib/subscription-tiers'
import { logSecurityEvent, EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED } from '@/lib/security/audit-log'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'
import { guardTrustedPersonAccess } from '@/lib/security/trusted-person-guard'
import { getActiveTrustedPersonShareTokens } from '@/lib/security/trusted-person-shares'
import {
  buildAccessLinkReadiness,
  fetchRelationshipKeyPairSet,
  hasRelationshipKeyForPair,
  parseAccessLinkDeviceSignal,
} from '@/lib/security/access-link-readiness'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(supabase, request, '/api/family/download')

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

    const guard = await guardTrustedPersonAccess(adminClient, ownerId, user.id, 'download')
    if (!guard.allowed || !guard.trustedPerson) {
      return NextResponse.json(
        { error: guard.details || 'Keine Berechtigung für diesen Download' },
        { status: 403 }
      )
    }
    const trustedPerson = guard.trustedPerson
    const deviceSignal = parseAccessLinkDeviceSignal(request)

    let relationshipKeyPairs = new Set<string>()
    try {
      relationshipKeyPairs = await fetchRelationshipKeyPairSet(adminClient, [{
        ownerId,
        trustedPersonId: trustedPerson.id,
      }])
    } catch (relationshipKeyError: any) {
      emitStructuredError({
        error_type: 'api',
        error_message: `[Family Download API] Error fetching relationship key readiness: ${relationshipKeyError?.message ?? String(relationshipKeyError)}`,
        endpoint: '/api/family/download',
      })
    }

    const accessLinkReadiness = buildAccessLinkReadiness(
      hasRelationshipKeyForPair(relationshipKeyPairs, ownerId, trustedPerson.id),
      deviceSignal
    )

    // Get owner profile with subscription info
    const { data: ownerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('full_name, email, subscription_status, stripe_price_id')
      .eq('id', ownerId)
      .single()

    if (profileError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Error fetching owner profile: ${profileError.message}`,
        endpoint: '/api/family/download',
      })
      return NextResponse.json(
        { error: 'Fehler beim Laden des Benutzerprofils' },
        { status: 500 }
      )
    }

    if (!ownerProfile) {
      return NextResponse.json(
        { error: 'Besitzer nicht gefunden' },
        { status: 404 }
      )
    }

    // Check owner's tier for download permission
    const ownerTier = getTierFromSubscription(
      ownerProfile.subscription_status || null,
      ownerProfile.stripe_price_id || null
    )

    if (!allowsFamilyDownloads(ownerTier)) {
      return NextResponse.json(
        { error: 'Der Besitzer dieses Lebensordners benötigt ein kostenpflichtiges Abo, damit Downloads verfügbar sind.' },
        { status: 403 }
      )
    }

    const ownerName = ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner'

    const { tokenMap, documentIds } = await getActiveTrustedPersonShareTokens(
      adminClient,
      ownerId,
      trustedPerson.id
    )

    if (documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Keine freigegebenen Dokumente zum Herunterladen vorhanden' },
        { status: 404 }
      )
    }

    // Get shared documents for this trusted person only
    const { data: documents, error: docsError } = await adminClient
      .from('documents')
      .select('*')
      .eq('user_id', ownerId)
      .in('id', documentIds)
      .order('category')
      .order('title')

    if (docsError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Error fetching documents: ${docsError.message}`,
        endpoint: '/api/family/download',
      })
      return NextResponse.json(
        { error: 'Fehler beim Laden der Dokumente' },
        { status: 500 }
      )
    }

    if (documents && documents.some((doc) => doc.is_encrypted)) {
      const responseDocuments: Array<{
        id: string
        file_name: string
        file_type: string
        category: string
        is_encrypted: boolean
        wrapped_dek_for_tp: string | null
        file_iv: string | null
      }> = []

      for (const doc of documents) {
        responseDocuments.push({
          id: doc.id,
          file_name: doc.file_name,
          file_type: doc.file_type,
          category: doc.category,
          is_encrypted: doc.is_encrypted,
          wrapped_dek_for_tp: tokenMap[doc.id] ?? null,
          file_iv: doc.file_iv ?? null,
        })
      }

      // Log security event for trusted person document download
      logSecurityEvent({
        user_id: ownerId,
        event_type: EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED,
        event_data: {
          owner_id: ownerId,
          trusted_person_id: trustedPerson.id,
          trusted_person_user_id: user.id,
          document_count: responseDocuments.length,
          action: 'download',
        },
        request: request as NextRequest,
      })

      return NextResponse.json({
        requiresClientDecryption: true,
        ownerName,
        accessLinkReadiness,
        documents: responseDocuments,
      })
    } else {
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
          emitStructuredError({
            error_type: 'api',
            error_message: `Error downloading file ${doc.file_path}: ${fileError?.message ?? 'unknown error'}`,
            endpoint: '/api/family/download',
          })
          continue
        }

        const categoryFolder = categoryNames[doc.category] || doc.category
        const filePath = `${categoryFolder}/${doc.file_name}`
        const arrayBuffer = await fileData.arrayBuffer()
        zip.file(filePath, arrayBuffer)
      } catch (err) {
        emitStructuredError({
          error_type: 'api',
          error_message: `Error processing document ${doc.id}: ${err instanceof Error ? err.message : String(err)}`,
          endpoint: '/api/family/download',
          stack: err instanceof Error ? err.stack : undefined,
        })
        continue
      }
    }

    // Log security event for trusted person document download
    logSecurityEvent({
      user_id: ownerId,
      event_type: EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED,
      event_data: {
        owner_id: ownerId,
        trusted_person_id: trustedPerson.id,
        trusted_person_user_id: user.id,
        document_count: documents.length,
        action: 'download',
      },
      request: request as NextRequest,
    })

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
    }
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Family download error: ${error?.message ?? String(error)}`,
      endpoint: '/api/family/download',
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
