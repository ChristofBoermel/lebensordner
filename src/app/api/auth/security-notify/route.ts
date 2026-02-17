import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendSecurityNotification } from '@/lib/email/security-notifications'
import { logSecurityEvent } from '@/lib/security/audit-log'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const body = await request.json()
    const { event } = body

    if (event !== 'password_changed') {
      return NextResponse.json({ error: 'Unbekanntes Event' }, { status: 400 })
    }

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const userName = profile?.full_name || 'Benutzer'

    await sendSecurityNotification('password_changed', user.email!, {
      userName,
      timestamp: new Date().toISOString(),
      ipAddress: clientIp,
    })

    await logSecurityEvent({
      user_id: user.id,
      event_type: 'password_changed',
      event_data: { notification_sent: true },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Security notify error:', error)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
