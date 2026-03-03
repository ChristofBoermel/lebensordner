import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emitStructuredError } from '@/lib/errors/structured-logger'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_vault_keys')
      .select('webauthn_credential_id, wrapped_mk_with_biometric, webauthn_rp_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Biometric key GET query error: ${error.message}`,
        endpoint: '/api/vault/biometric-key',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!data || !data.webauthn_credential_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      webauthn_credential_id: data.webauthn_credential_id,
      wrapped_mk_with_biometric: data.wrapped_mk_with_biometric,
      webauthn_rp_id: data.webauthn_rp_id,
    })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Biometric key GET error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/vault/biometric-key',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { wrapped_mk_with_biometric, webauthn_credential_id, webauthn_rp_id } = body || {}

    if (
      !isNonEmptyString(wrapped_mk_with_biometric) ||
      !isNonEmptyString(webauthn_credential_id) ||
      !isNonEmptyString(webauthn_rp_id)
    ) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_vault_keys')
      .update({
        wrapped_mk_with_biometric,
        webauthn_credential_id,
        webauthn_rp_id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Biometric key POST update error: ${error.message}`,
        endpoint: '/api/vault/biometric-key',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Biometric key POST error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/vault/biometric-key',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('user_vault_keys')
      .update({
        wrapped_mk_with_biometric: null,
        webauthn_credential_id: null,
        webauthn_rp_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Biometric key DELETE update error: ${error.message}`,
        endpoint: '/api/vault/biometric-key',
      })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Biometric key DELETE error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/vault/biometric-key',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
