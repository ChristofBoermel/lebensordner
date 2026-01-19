import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ownerId = searchParams.get('ownerId')

    if (!ownerId) {
      return NextResponse.json({ error: 'Owner ID erforderlich' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()

    // Check if user has active approved access
    const { data: accessRequest, error: accessError } = await adminClient
      .from('emergency_access_requests')
      .select('*, trusted_persons(access_level)')
      .eq('requester_id', user.id)
      .eq('owner_id', ownerId)
      .eq('status', 'approved')
      .gt('expires_at', new Date().toISOString())
      .order('approved_at', { ascending: false })
      .limit(1)
      .single()

    if (accessError || !accessRequest) {
      return NextResponse.json({
        error: 'Kein aktiver Notfallzugriff vorhanden',
        details: 'Bitte fordern Sie Zugriff an oder warten Sie auf Genehmigung'
      }, { status: 403 })
    }

    // Get owner's documents
    const { data: documents, error: docsError } = await adminClient
      .from('documents')
      .select('id, title, category, file_name, file_type, file_size, created_at, expiry_date, notes')
      .eq('user_id', ownerId)
      .order('category')
      .order('title')

    if (docsError) {
      console.error('Error fetching documents:', docsError)
      return NextResponse.json({ error: 'Fehler beim Laden der Dokumente' }, { status: 500 })
    }

    // Get owner's emergency info (medical info, advance directives, etc.)
    const { data: medicalInfo } = await adminClient
      .from('medical_info')
      .select('*')
      .eq('user_id', ownerId)
      .single()

    const { data: advanceDirectives } = await adminClient
      .from('advance_directives')
      .select('*')
      .eq('user_id', ownerId)
      .single()

    const { data: emergencyContacts } = await adminClient
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', ownerId)
      .order('is_primary', { ascending: false })

    const { data: funeralWishes } = await adminClient
      .from('funeral_wishes')
      .select('*')
      .eq('user_id', ownerId)
      .single()

    return NextResponse.json({
      success: true,
      access: {
        expires_at: accessRequest.expires_at,
        approved_at: accessRequest.approved_at,
      },
      documents: documents || [],
      emergency_info: {
        medical: medicalInfo || null,
        directives: advanceDirectives || null,
        contacts: emergencyContacts || [],
        funeral: funeralWishes || null,
      }
    })
  } catch (error: any) {
    console.error('Emergency access documents error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
