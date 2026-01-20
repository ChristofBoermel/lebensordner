import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Service role client for cross-user queries
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

    // Get all trusted_persons records where current user is the linked_user_id
    const { data: accessRecords, error: fetchError } = await adminClient
      .from('trusted_persons')
      .select(`
        id,
        name,
        relationship,
        access_level,
        invitation_accepted_at,
        user_id,
        profiles!trusted_persons_user_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('linked_user_id', user.id)
      .eq('invitation_status', 'accepted')

    if (fetchError) {
      console.error('Error fetching access records:', fetchError)
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }

    // Check for active emergency access requests
    const { data: activeRequests } = await adminClient
      .from('emergency_access_requests')
      .select('*')
      .eq('requester_id', user.id)
      .in('status', ['pending', 'approved'])

    const activeRequestMap = new Map(
      (activeRequests || []).map(r => [r.trusted_person_id, r])
    )

    // Transform the data to include owner info and access status
    const accessList = (accessRecords || []).map(record => {
      const ownerProfile = record.profiles as any
      const activeRequest = activeRequestMap.get(record.id)

      return {
        trusted_person_id: record.id,
        owner_id: record.user_id,
        owner_name: ownerProfile?.full_name || 'Unbekannt',
        owner_email: ownerProfile?.email || '',
        relationship: record.relationship,
        access_level: record.access_level,
        accepted_at: record.invitation_accepted_at,
        emergency_access: activeRequest ? {
          status: activeRequest.status,
          requested_at: activeRequest.created_at,
          approved_at: activeRequest.approved_at,
          expires_at: activeRequest.expires_at,
        } : null
      }
    })

    return NextResponse.json({
      success: true,
      access: accessList
    })
  } catch (error: any) {
    console.error('My access error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
