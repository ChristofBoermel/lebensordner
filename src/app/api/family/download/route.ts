import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { getTierFromSubscription, allowsFamilyDownloads } from '@/lib/subscription-tiers'
import { logSecurityEvent, EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED } from '@/lib/security/audit-log'

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
        { error: 'Keine Berechtigung für diesen Download' },
        { status: 403 }
      )
    }

    // Get owner profile with subscription info
    const { data: ownerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('full_name, email, subscription_status, stripe_price_id')
      .eq('id', ownerId)
      .single()

    if (profileError) {
      console.error('Error fetching owner profile:', profileError)
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
        { error: 'Der Besitzer dieses Lebensordners hat ein Basis-Abo. Downloads sind nur mit Premium verfügbar. Bitte kontaktieren Sie den Besitzer für ein Upgrade.' },
        { status: 403 }
      )
    }

    const ownerName = ownerProfile?.full_name || ownerProfile?.email || 'Lebensordner'

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

    if (documents && documents.some((doc) => doc.is_encrypted)) {
      const { data: trustedPersonRows, error: tpIdsError } = await adminClient
        .from('trusted_persons')
        .select('id')
        .eq('linked_user_id', user.id)
        .eq('user_id', ownerId)

      if (tpIdsError) {
        console.error('Error fetching trusted person ids:', tpIdsError)
        return NextResponse.json(
          { error: 'Fehler beim Laden der Dokumente' },
          { status: 500 }
        )
      }

      const trustedPersonIds = (trustedPersonRows || []).map((row) => row.id)

      const { data: shareTokens, error: shareTokensError } = await adminClient
        .from('document_share_tokens')
        .select('document_id, wrapped_dek_for_tp')
        .eq('owner_id', ownerId)
        .in('trusted_person_id', trustedPersonIds)

      if (shareTokensError) {
        console.error('Error fetching share tokens:', shareTokensError)
        return NextResponse.json(
          { error: 'Fehler beim Laden der Dokumente' },
          { status: 500 }
        )
      }

      const tokenMap: Record<string, string> = {}
      for (const token of shareTokens || []) {
        tokenMap[token.document_id] = token.wrapped_dek_for_tp
      }

      const responseDocuments: Array<{
        id: string
        file_path: string
        file_name: string
        file_type: string
        category: string
        is_encrypted: boolean
        wrapped_dek_for_tp: string | null
        file_iv: string | null
        signedUrl: string
      }> = []

      for (const doc of documents) {
        const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
          .from('documents')
          .createSignedUrl(doc.file_path, 3600)

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('Error creating signed URL:', signedUrlError)
          return NextResponse.json(
            { error: 'Fehler beim Laden der Dokumente' },
            { status: 500 }
          )
        }

        responseDocuments.push({
          id: doc.id,
          file_path: doc.file_path,
          file_name: doc.file_name,
          file_type: doc.file_type,
          category: doc.category,
          is_encrypted: doc.is_encrypted,
          wrapped_dek_for_tp: tokenMap[doc.id] ?? null,
          file_iv: doc.file_iv ?? null,
          signedUrl: signedUrlData.signedUrl,
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
          document_count: documents.length,
          action: 'download',
        },
        request: request as NextRequest,
      })

      return NextResponse.json({
        requiresClientDecryption: true,
        ownerName,
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
    console.error('Family download error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
