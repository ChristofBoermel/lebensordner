import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_ANON_KEY']!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const nowIso = new Date().toISOString()
    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Debounce activity writes: update only when stale/missing and clear prior emergency notification marker.
    try {
      await supabase
        .from('profiles')
        .update({
          last_active_at: nowIso,
          emergency_access_notified_at: null,
        })
        .eq('id', user.id)
        .or(`last_active_at.is.null,last_active_at.lt.${oneHourAgoIso}`)
    } catch {
      // Best-effort write: activity tracking must not break request/session middleware.
    }
  }

  const protectedRoutes = ['/dashboard', '/dokumente', '/notfall', '/zugriff']
  const authRoutes = ['/anmelden', '/registrieren']
  const pathname = request.nextUrl.pathname
  const isTrustedAccessRedeemRoute = pathname === '/zugriff/access/redeem'

  if (
    !user &&
    !isTrustedAccessRedeemRoute &&
    protectedRoutes.some(route => pathname.startsWith(route))
  ) {
    return NextResponse.redirect(new URL('/anmelden', request.url))
  }

  if (user && authRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}
