import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emitStructuredError } from '@/lib/errors/structured-logger'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params
    const token = params.token

    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()

    const { data: downloadToken, error: tokenError } = await adminClient
      .from('download_tokens')
      .select('id, link_type')
      .eq('token', token)
      .single()

    if (tokenError || !downloadToken) {
      return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
    }

    if (downloadToken.link_type === 'view') {
      return NextResponse.json({ success: true })
    }

    const { error: updateError } = await adminClient
      .from('download_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', downloadToken.id)

    if (updateError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Error marking download link used: ${updateError.message}`,
        endpoint: '/api/download-link/[token]/mark-used',
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Mark download link used error: ${error?.message ?? String(error)}`,
      endpoint: '/api/download-link/[token]/mark-used',
      stack: error?.stack,
    })
    return NextResponse.json({ success: true })
  }
}
