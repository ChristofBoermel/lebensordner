import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/guards'
import { logSecurityEvent, EVENT_ADMIN_USERS_VIEWED } from '@/lib/security/audit-log'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const { user } = await requireAdmin()
    const supabase = createServiceClient()

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at, onboarding_completed, subscription_status')
      .order('created_at', { ascending: false })

    if (profilesError) {
      throw profilesError
    }

    const { data: storageDocs, error: storageError } = await supabase
      .from('documents')
      .select('user_id, file_size')

    if (storageError) {
      throw storageError
    }

    const storageByUser = new Map<string, number>()
    for (const doc of storageDocs || []) {
      const current = storageByUser.get(doc.user_id) ?? 0
      storageByUser.set(doc.user_id, current + (doc.file_size || 0))
    }

    const users = (profiles || []).map((profile) => ({
      ...profile,
      storage_used: storageByUser.get(profile.id) ?? 0,
    }))

    logSecurityEvent({
      event_type: EVENT_ADMIN_USERS_VIEWED,
      user_id: user.id,
    })

    return NextResponse.json(users)
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (error.statusCode === 403) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
