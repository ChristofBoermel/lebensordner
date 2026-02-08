import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/guards'
import { logSecurityEvent, EVENT_ADMIN_STATS_VIEWED } from '@/lib/security/audit-log'

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

    const [
      totalUsersResult,
      activeSubscriptionsResult,
      trialingUsersResult,
      totalDocumentsResult,
      storageResult,
      onboardingResult,
      last7DaysResult,
      last30DaysResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('file_size'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    const totalStorageBytes = storageResult.data?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) ?? 0
    const totalStorageMb = totalStorageBytes / (1024 * 1024)

    const stats = {
      total_users: totalUsersResult.count ?? 0,
      active_subscriptions: activeSubscriptionsResult.count ?? 0,
      trialing_users: trialingUsersResult.count ?? 0,
      total_documents: totalDocumentsResult.count ?? 0,
      total_storage_used_mb: totalStorageMb,
      users_completed_onboarding: onboardingResult.count ?? 0,
      users_last_7_days: last7DaysResult.count ?? 0,
      users_last_30_days: last30DaysResult.count ?? 0,
    }

    logSecurityEvent({
      event_type: EVENT_ADMIN_STATS_VIEWED,
      user_id: user.id,
    })

    return NextResponse.json(stats)
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (error.statusCode === 403) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
