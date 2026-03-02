import type { SupabaseClient, User } from '@supabase/supabase-js'
import { emitStructuredWarn } from '@/lib/errors/structured-logger'

const BEARER_PREFIX = 'Bearer '

function hasSupabaseAuthCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  return cookieHeader.includes('sb-') && cookieHeader.includes('-auth-token')
}

export async function resolveAuthenticatedUser(
  supabase: SupabaseClient,
  request: Request,
  endpoint: string
): Promise<User | null> {
  const primary = await supabase.auth.getUser()
  if (primary.data.user) {
    return primary.data.user
  }

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith(BEARER_PREFIX)
    ? authHeader.slice(BEARER_PREFIX.length).trim()
    : null

  if (bearerToken) {
    const tokenResult = await supabase.auth.getUser(bearerToken)
    if (tokenResult.data.user) {
      return tokenResult.data.user
    }
  }

  const retry = await supabase.auth.getUser()
  if (retry.data.user) {
    return retry.data.user
  }

  emitStructuredWarn({
    event_type: 'auth',
    event_message: 'Server authentication failed',
    endpoint,
    metadata: {
      hasAuthorizationHeader: Boolean(authHeader),
      hasSupabaseAuthCookie: hasSupabaseAuthCookie(request.headers.get('cookie')),
      primaryError: primary.error?.message,
      retryError: retry.error?.message,
    },
  })

  return null
}
