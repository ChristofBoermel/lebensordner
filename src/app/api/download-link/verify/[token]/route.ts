import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
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

    // Find the download token
    const { data: downloadToken, error: tokenError } = await adminClient
      .from('download_tokens')
      .select('*, user:user_id(full_name, email)')
      .eq('token', token)
      .single()

    if (tokenError || !downloadToken) {
      return NextResponse.json(
        { error: 'Ungültiger Link' },
        { status: 404 }
      )
    }

    // Check if token has expired
    if (new Date(downloadToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Dieser Link ist abgelaufen' },
        { status: 410 }
      )
    }

    // Check if token was already used
    if (downloadToken.used_at) {
      return NextResponse.json(
        { error: 'Dieser Link wurde bereits verwendet' },
        { status: 410 }
      )
    }

    // Get sender info - fetch separately since foreign key syntax varies
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', downloadToken.user_id)
      .single()

    const senderName = profile?.full_name || profile?.email || 'Unbekannt'

    return NextResponse.json({
      valid: true,
      senderName,
      expiresAt: downloadToken.expires_at,
      linkType: downloadToken.link_type || 'download',
    })
  } catch (error: any) {
    console.error('Verify token error:', error)
    return NextResponse.json(
      { error: 'Serverfehler' },
      { status: 500 }
    )
  }
}
