import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

type Body = {
  accessToken?: string
  refreshToken?: string
}

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get('x-e2e-secret')
  if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  if (!body.accessToken || !body.refreshToken) {
    return NextResponse.json({ error: 'missing_tokens' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
