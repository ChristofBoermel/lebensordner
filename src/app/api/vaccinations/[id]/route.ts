import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'

const parseMonth = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const month = Number(value)
  if (!Number.isInteger(month) || month < 1 || month > 12) return NaN
  return month
}

const parseYear = (value: unknown) => {
  if (value === null || value === undefined || value === '') return NaN
  const year = Number(value)
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return NaN
  return year
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const { id } = await params

    const body = await request.json()
    const { name, month, year } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
    }

    const parsedMonth = parseMonth(month)
    if (Number.isNaN(parsedMonth)) {
      return NextResponse.json({ error: 'Ungültiger Monat' }, { status: 400 })
    }

    const parsedYear = parseYear(year)
    if (Number.isNaN(parsedYear)) {
      return NextResponse.json({ error: 'Ungültiges Jahr' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('vaccinations')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (existingError || !existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('vaccinations')
      .update({
        name: name.trim(),
        month: parsedMonth ?? null,
        year: parsedYear,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Vaccinations PUT error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren der Impfung' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const { id } = await params

    const { data: existing, error: existingError } = await supabase
      .from('vaccinations')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (existingError || !existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('vaccinations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Vaccinations DELETE error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Impfung' },
      { status: 500 }
    )
  }
}
