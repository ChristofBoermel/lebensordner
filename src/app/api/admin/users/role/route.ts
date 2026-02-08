import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/guards'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logSecurityEvent, EVENT_ADMIN_ROLE_CHANGED } from '@/lib/security/audit-log'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdmin()

    const body = await request.json()
    const { targetUserId, newRole } = body

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
    }

    if (newRole !== 'user' && newRole !== 'admin') {
      return NextResponse.json({ error: 'newRole must be "user" or "admin"' }, { status: 400 })
    }

    // Fetch previous role for audit logging
    const supabase = await createServerSupabaseClient()
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .single()

    const previousRole = targetProfile?.role ?? 'unknown'

    // Use service role client to bypass RLS for role updates
    const serviceClient = createServiceClient()
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId)

    if (updateError) {
      throw updateError
    }

    logSecurityEvent({
      event_type: EVENT_ADMIN_ROLE_CHANGED,
      user_id: user.id,
      event_data: { targetUserId, newRole, previousRole },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (error.statusCode === 403) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin role update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
