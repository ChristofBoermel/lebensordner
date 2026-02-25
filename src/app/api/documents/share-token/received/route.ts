import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trustedPersons, error: trustedPersonsError } = await supabase
    .from('trusted_persons')
    .select('id')
    .eq('linked_user_id', user.id)

  if (trustedPersonsError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const trustedPersonIds = (trustedPersons ?? []).map((tp) => tp.id)

  if (trustedPersonIds.length === 0) {
    return NextResponse.json({ shares: [] })
  }

  const { data, error } = await supabase
    .from('document_share_tokens')
    .select('id, document_id, owner_id, wrapped_dek_for_tp, expires_at, permission, documents(id, title, category, file_name, file_iv, file_type), profiles!owner_id(full_name, first_name, last_name)')
    .in('trusted_person_id', trustedPersonIds)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ shares: data ?? [] })
}
