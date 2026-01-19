import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const adminClient = getSupabaseAdmin()

    // Get pending emergency access requests where current user is the owner
    const { data: requests, error: fetchError } = await adminClient
      .from('emergency_access_requests')
      .select(`
        id,
        trusted_person_id,
        requester_id,
        status,
        reason,
        created_at,
        trusted_persons (
          name
        )
      `)
      .eq('owner_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching requests:', fetchError)
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }

    // Get requester names
    const requestsWithNames = await Promise.all(
      (requests || []).map(async (req) => {
        const { data: requesterProfile } = await adminClient
          .from('profiles')
          .select('full_name')
          .eq('id', req.requester_id)
          .single()

        return {
          ...req,
          requester_name: requesterProfile?.full_name || 'Unbekannt',
          trusted_person_name: (req.trusted_persons as any)?.name || 'Unbekannt',
        }
      })
    )

    return NextResponse.json({
      success: true,
      requests: requestsWithNames
    })
  } catch (error: any) {
    console.error('Pending requests error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
