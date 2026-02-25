import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'

const STANDARD_VACCINATIONS = [
  'Tetanus',
  'Diphtherie',
  'Pertussis (Keuchhusten)',
  'Masern',
  'Mumps',
  'Röteln',
  'Influenza',
  'COVID-19',
  'Hepatitis B',
  'FSME (Frühsommer-Meningoenzephalitis)',
]

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

export async function GET() {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('vaccinations')
      .select('*')
      .eq('user_id', user.id)
      .order('is_standard', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      return NextResponse.json({ vaccinations: data })
    }

    const seedRows = STANDARD_VACCINATIONS.map((name) => ({
      user_id: user.id,
      name,
      is_standard: true,
      month: null,
      year: null,
    }))

    const { error: insertError } = await supabase
      .from('vaccinations')
      .insert(seedRows)

    if (insertError) {
      throw insertError
    }

    const { data: seededData, error: seededError } = await supabase
      .from('vaccinations')
      .select('*')
      .eq('user_id', user.id)
      .order('is_standard', { ascending: false })
      .order('name', { ascending: true })

    if (seededError) {
      throw seededError
    }

    return NextResponse.json({ vaccinations: seededData || [] })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Vaccinations GET error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Impfungen' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth()
    const supabase = await createServerSupabaseClient()

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

    const { data, error } = await supabase
      .from('vaccinations')
      .insert({
        user_id: user.id,
        name: name.trim(),
        month: parsedMonth ?? null,
        year: parsedYear,
        is_standard: false,
      })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ vaccination: data }, { status: 201 })
  } catch (error: any) {
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    console.error('Vaccinations POST error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern der Impfung' },
      { status: 500 }
    )
  }
}
