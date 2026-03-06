import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(supabase, request, '/api/trusted-person/link')

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    if (!user.email) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'Keine E-Mail am Konto vorhanden, keine Verknüpfung möglich',
      })
    }

    const normalizedEmail = user.email.toLowerCase().trim()

    // Link accepted invitations by immutable invited email with user-scoped auth only.
    const { data: userUpdateRows, error: userUpdateError } = await supabase
      .from('trusted_persons')
      .update({ linked_user_id: user.id })
      .ilike('email', normalizedEmail)
      .eq('invitation_status', 'accepted')
      .eq('is_active', true)
      .is('linked_user_id', null)
      .select('id')

    if (userUpdateError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `User-scoped trusted-person linking failed: ${userUpdateError.message}`,
        endpoint: '/api/trusted-person/link',
      })
      return NextResponse.json(
        { error: 'Verknüpfung derzeit nicht möglich' },
        { status: 500 }
      )
    }

    const linkedCount = userUpdateRows?.length ?? 0

    return NextResponse.json({
      success: true,
      linked: linkedCount,
      message: linkedCount > 0
        ? `${linkedCount} Verknüpfung(en) erstellt`
        : 'Keine ausstehenden Verknüpfungen gefunden',
    })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Link trusted person error: ${error?.message ?? String(error)}`,
      endpoint: '/api/trusted-person/link',
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
