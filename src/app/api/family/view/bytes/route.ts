import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getTierFromSubscription } from '@/lib/subscription-tiers'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')
    const ownerId = searchParams.get('ownerId')

    if (!docId || !ownerId) {
      return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env['SUPABASE_URL']!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: trustedPerson, error: tpError } = await adminClient
      .from('trusted_persons')
      .select('id')
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

    const { data: ownerProfile } = await adminClient
      .from('profiles')
      .select('subscription_status, stripe_price_id')
      .eq('id', ownerId)
      .single()

    const ownerTier = getTierFromSubscription(
      ownerProfile?.subscription_status ?? null,
      ownerProfile?.stripe_price_id ?? null
    )

    if (ownerTier.id === 'free') {
      return NextResponse.json(
        {
          error:
            'Der Besitzer hat ein kostenloses Abo. Ansicht ist nur mit einem kostenpflichtigen Abo verfügbar.'
        },
        { status: 403 }
      )
    }

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

    return new NextResponse(await fileData.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.file_name}"`,
      },
    })
  } catch (error: any) {
    console.error('Bytes error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
