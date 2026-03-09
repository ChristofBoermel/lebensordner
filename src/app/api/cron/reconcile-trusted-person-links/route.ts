import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emitStructuredError, emitStructuredInfo, emitStructuredWarn } from '@/lib/errors/structured-logger'

const CRON_SECRET = process.env.CRON_SECRET

const normalizeEmail = (value: string) => value.toLowerCase().trim()

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables missing')
  }
  return createClient(url, key)
}

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    emitStructuredError({
      error_type: 'auth',
      error_message: 'Request rejected: CRON_SECRET is not configured',
      endpoint: '/api/cron/reconcile-trusted-person-links',
    })
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    emitStructuredWarn({
      event_type: 'auth',
      event_message: 'Unauthorized cron request rejected',
      endpoint: '/api/cron/reconcile-trusted-person-links',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = {
    scanned: 0,
    matched: 0,
    updated: 0,
    unmatched: 0,
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data: pendingRows, error: pendingError } = await supabase
      .from('trusted_persons')
      .select('id, email')
      .eq('invitation_status', 'accepted')
      .eq('is_active', true)
      .is('linked_user_id', null)
      .not('email', 'is', null)
      .limit(500)

    if (pendingError) {
      throw new Error(`Failed to fetch pending trusted-person links: ${pendingError.message}`)
    }

    stats.scanned = pendingRows?.length ?? 0

    if (stats.scanned === 0) {
      emitStructuredInfo({
        event_type: 'worker',
        event_message: 'Trusted-person link reconciliation found no pending rows',
        endpoint: '/api/cron/reconcile-trusted-person-links',
        metadata: stats,
      })
      return NextResponse.json({ success: true, ...stats, timestamp: new Date().toISOString() })
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .not('email', 'is', null)

    if (profilesError) {
      throw new Error(`Failed to fetch profiles for reconciliation: ${profilesError.message}`)
    }

    const profileByEmail = new Map<string, string>()
    for (const profile of profiles ?? []) {
      const email = profile.email
      if (typeof email !== 'string' || email.trim() === '') continue
      const normalized = normalizeEmail(email)
      if (!profileByEmail.has(normalized)) {
        profileByEmail.set(normalized, profile.id)
      }
    }

    for (const row of pendingRows ?? []) {
      const normalizedTrustedEmail = normalizeEmail(row.email)
      const linkedUserId = profileByEmail.get(normalizedTrustedEmail)

      if (!linkedUserId) {
        stats.unmatched += 1
        continue
      }

      stats.matched += 1

      const { data: updatedRows, error: updateError } = await supabase
        .from('trusted_persons')
        .update({ linked_user_id: linkedUserId })
        .eq('id', row.id)
        .eq('invitation_status', 'accepted')
        .is('linked_user_id', null)
        .select('id')

      if (updateError) {
        emitStructuredWarn({
          event_type: 'worker',
          event_message: 'Trusted-person link reconciliation row update failed',
          endpoint: '/api/cron/reconcile-trusted-person-links',
          metadata: {
            trustedPersonId: row.id,
            reason: updateError.message,
          },
        })
        continue
      }

      if ((updatedRows?.length ?? 0) > 0) {
        stats.updated += 1
      }
    }

    emitStructuredInfo({
      event_type: 'worker',
      event_message: 'Trusted-person link reconciliation completed',
      endpoint: '/api/cron/reconcile-trusted-person-links',
      metadata: stats,
    })

    return NextResponse.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'worker',
      error_message: `Trusted-person link reconciliation failed: ${error?.message ?? String(error)}`,
      endpoint: '/api/cron/reconcile-trusted-person-links',
      stack: error?.stack,
    })
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'Serverfehler',
        ...stats,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
