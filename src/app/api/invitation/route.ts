import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role to bypass RLS for public invitation pages
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

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
      console.error('Invitation lookup error:', error)
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
    console.error('Invitation API error:', error)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { token, action, email } = await request.json()

    if (!token || !action) {
      return NextResponse.json({ error: 'Token und Aktion erforderlich' }, { status: 400 })
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

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

      // First, get the invitation to find the user_id for duplicate checking
      const { data: invitation, error: fetchError } = await supabase
        .from('trusted_persons')
        .select('id, user_id')
        .eq('invitation_token', token)
        .single()

      if (fetchError || !invitation) {
        console.error('Invitation fetch error:', fetchError)
        return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
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
      updateData.email = normalizedEmail
    }

    const { error } = await supabase
      .from('trusted_persons')
      .update(updateData)
      .eq('invitation_token', token)

    if (error) {
      console.error('Invitation update error:', error)
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Invitation POST error:', error)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
