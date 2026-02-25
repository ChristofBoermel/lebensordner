import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { documentId, trustedPersonId, wrapped_dek_for_tp, expires_at, permission } = body || {}

  if (!documentId || !trustedPersonId || !wrapped_dek_for_tp) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: document } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!document) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: trustedPerson } = await supabase
    .from('trusted_persons')
    .select('id, linked_user_id')
    .eq('id', trustedPersonId)
    .eq('user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .maybeSingle()

  if (!trustedPerson) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (trustedPerson.linked_user_id === null) {
    return NextResponse.json({ error: 'Trusted person has not accepted the invitation' }, { status: 403 })
  }

  const { error } = await supabase
    .from('document_share_tokens')
    .upsert({
      document_id: documentId,
      owner_id: user.id,
      trusted_person_id: trustedPersonId,
      wrapped_dek_for_tp,
      expires_at: expires_at ?? null,
      permission: permission ?? 'view'
    }, { onConflict: 'document_id,trusted_person_id' })

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ownerId = searchParams.get('ownerId')

  if (!ownerId) {
    return NextResponse.json({ error: 'ownerId parameter required' }, { status: 400 })
  }

  const { data: trustedPersons, error: trustedPersonsError } = await supabase
    .from('trusted_persons')
    .select('id')
    .eq('linked_user_id', user.id)

  if (trustedPersonsError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const trustedPersonIds = (trustedPersons ?? []).map((trustedPerson) => trustedPerson.id)

  if (trustedPersonIds.length === 0) {
    return NextResponse.json({ tokens: [] })
  }

  const { data, error } = await supabase
    .from('document_share_tokens')
    .select('id, document_id, wrapped_dek_for_tp, expires_at, permission, revoked_at')
    .eq('owner_id', ownerId)
    .in('trusted_person_id', trustedPersonIds)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ tokens: data ?? [] })
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
  }

  const { data: shareToken } = await supabase
    .from('document_share_tokens')
    .select('id, owner_id')
    .eq('id', id)
    .maybeSingle()

  if (!shareToken || shareToken.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('document_share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
