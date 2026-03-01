import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emitStructuredError } from '@/lib/errors/structured-logger'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_vault_keys')
      .select('kdf_salt, kdf_params, wrapped_mk, wrapped_mk_with_recovery, recovery_key_salt')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Key material query error: ${error.message}`,
        endpoint: '/api/vault/key-material',
      })
      return NextResponse.json({ exists: false })
    }

    if (!data) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      kdf_salt: data.kdf_salt,
      kdf_params: data.kdf_params,
      wrapped_mk: data.wrapped_mk,
      wrapped_mk_with_recovery: data.wrapped_mk_with_recovery,
      recovery_key_salt: data.recovery_key_salt
    })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Key material GET error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/vault/key-material',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ exists: false })
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { kdf_salt, kdf_params, wrapped_mk, wrapped_mk_with_recovery, recovery_key_salt } =
    body || {}

  if (!kdf_salt || !kdf_params || !wrapped_mk || !wrapped_mk_with_recovery || !recovery_key_salt) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_vault_keys')
    .upsert({
      user_id: user.id,
      kdf_salt,
      kdf_params,
      wrapped_mk,
      wrapped_mk_with_recovery,
      recovery_key_salt,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
