import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'
import { createHash } from 'crypto'

// Use service role to bypass RLS for public invitation pages
const getSupabaseAdmin = () => {
  return createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const OPEN_INVITATION_STATUSES = ['pending', 'sent', 'failed'] as const
const CLOSED_INVITATION_STATUSES = ['accepted', 'declined'] as const

function getTokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const host = request.headers.get('host') || 'unknown'

  if (!token) {
    return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('trusted_persons')
      .select(`
        id,
        name,
        email,
        relationship,
        access_level,
        invitation_status,
        user_id,
        profiles!trusted_persons_user_id_fkey (
          full_name
        )
      `)
      .eq('invitation_token', token)
      .single()

    if (error || !data) {
      const reason = error?.code === 'PGRST116' ? 'no_row_or_multiple_rows' : 'db_error'
      emitStructuredError({
        error_type: 'api',
        error_message: `Invitation lookup error: ${error?.message ?? 'not found'}`,
        endpoint: '/api/invitation',
        metadata: {
          reason,
          invite_fp: getTokenFingerprint(token),
          host,
        },
      })
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      email: data.email,
      relationship: data.relationship,
      access_level: data.access_level,
      invitation_status: data.invitation_status,
      owner_name: (data.profiles as any)?.full_name || 'Unbekannt',
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Invitation API error: ${error?.message ?? String(error)}`,
      endpoint: '/api/invitation',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { token, action, email } = await request.json()
    const host = request.headers.get('host') || 'unknown'

    if (!token || !action) {
      return NextResponse.json({ error: 'Token und Aktion erforderlich' }, { status: 400 })
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: invitation, error: fetchError } = await supabase
      .from('trusted_persons')
      .select('id, user_id, email, invitation_status')
      .eq('invitation_token', token)
      .single()

    if (fetchError || !invitation) {
      const reason = fetchError?.code === 'PGRST116' ? 'no_row_or_multiple_rows' : 'db_error'
      emitStructuredError({
        error_type: 'api',
        error_message: `Invitation fetch error: ${fetchError?.message ?? 'not found'}`,
        endpoint: '/api/invitation',
        metadata: {
          reason,
          invite_fp: getTokenFingerprint(token),
          host,
        },
      })
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }

    if (CLOSED_INVITATION_STATUSES.includes(invitation.invitation_status)) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: 'Invitation already processed',
        endpoint: '/api/invitation',
        metadata: {
          invite_fp: getTokenFingerprint(token),
          status: invitation.invitation_status,
          host,
        },
      })
      return NextResponse.json(
        { error: 'Diese Einladung wurde bereits bearbeitet' },
        { status: 409 }
      )
    }

    const updateData: Record<string, any> = {
      invitation_status: action === 'accept' ? 'accepted' : 'declined',
    }

    if (action === 'accept') {
      // Validate email is provided for acceptance
      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'E-Mail-Adresse erforderlich' }, { status: 400 })
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const normalizedEmail = email.toLowerCase().trim()
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })
      }

      // Token-only model remains, but acceptance email must match the invited email exactly.
      if (normalizedEmail !== invitation.email.toLowerCase().trim()) {
        emitStructuredWarn({
          event_type: 'auth',
          event_message: 'Invitation accept email mismatch',
          endpoint: '/api/invitation',
          metadata: {
            invite_fp: getTokenFingerprint(token),
            status: invitation.invitation_status,
            host,
          },
        })
        return NextResponse.json(
          { error: 'Diese Einladung ist nur für die ursprünglich eingeladene E-Mail gültig' },
          { status: 403 }
        )
      }

      // Check for duplicate email (case-insensitive)
      const { data: existingPerson } = await supabase
        .from('trusted_persons')
        .select('id')
        .eq('user_id', invitation.user_id)
        .neq('id', invitation.id)
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (existingPerson) {
        return NextResponse.json(
          { error: 'Diese E-Mail-Adresse wurde bereits als Vertrauensperson hinzugefügt' },
          { status: 400 }
        )
      }

      updateData.invitation_accepted_at = new Date().toISOString()
    }

    const { data: updatedRow, error } = await supabase
      .from('trusted_persons')
      .update(updateData)
      .eq('id', invitation.id)
      .in('invitation_status', OPEN_INVITATION_STATUSES as unknown as string[])
      .select('id')
      .maybeSingle()

    if (error) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Invitation update error: ${error.message}`,
        endpoint: '/api/invitation',
      })
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
    }

    if (!updatedRow) {
      emitStructuredWarn({
        event_type: 'api',
        event_message: 'Invitation optimistic update rejected',
        endpoint: '/api/invitation',
        metadata: {
          invite_fp: getTokenFingerprint(token),
          host,
        },
      })
      return NextResponse.json(
        { error: 'Diese Einladung wurde bereits bearbeitet' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Invitation POST error: ${error?.message ?? String(error)}`,
      endpoint: '/api/invitation',
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
