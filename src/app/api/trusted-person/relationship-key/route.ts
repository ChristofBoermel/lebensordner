import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { trustedPersonId, wrapped_rk } = body || {}

  if (!trustedPersonId || !wrapped_rk) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: trustedPerson } = await supabase
    .from('trusted_persons')
    .select('id')
    .eq('id', trustedPersonId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!trustedPerson) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('document_relationship_keys')
    .upsert({
      owner_id: user.id,
      trusted_person_id: trustedPersonId,
      wrapped_rk
    }, { onConflict: 'owner_id,trusted_person_id' })

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
