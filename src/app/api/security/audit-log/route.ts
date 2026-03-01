import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'
import { emitStructuredError } from '@/lib/errors/structured-logger'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { searchParams } = new URL(request.url)
    const eventType = searchParams.get('event_type')
    const limitParam = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Math.min(Math.max(1, limitParam), 100)

    let query = supabase
      .from('security_audit_log')
      .select('id, event_type, timestamp, ip_address, user_agent')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    const { data, error } = await query

    if (error) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Audit log query error: ${error.message}`,
        endpoint: '/api/security/audit-log',
      })
      return NextResponse.json({ error: 'Fehler beim Laden der Aktivitäten' }, { status: 500 })
    }

    return NextResponse.json({ events: data || [] })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    emitStructuredError({
      error_type: 'api',
      error_message: `Audit log GET error: ${error?.message ?? String(error)}`,
      endpoint: '/api/security/audit-log',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
