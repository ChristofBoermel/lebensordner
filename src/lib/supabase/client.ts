import { createBrowserClient } from '@supabase/ssr'

const PERSISTENCE_KEY = 'supabase-persist-mode'

export interface CreateClientOptions {
  persist?: boolean
}

/**
 * Factory that returns a Supabase browser client.
 *
 * - `persist: true`  (default) → session stored in localStorage (survives browser close)
 * - `persist: false` → session stored in sessionStorage (cleared on browser close)
 *
 * When called without options the function checks a sessionStorage flag
 * set by `setSessionPersistence` so that every page automatically picks the
 * storage backend chosen at login time.
 */
export function createClient(options: CreateClientOptions = {}) {
  const persist = options.persist ?? shouldPersistSession()

  if (!persist && typeof window !== 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          storage: window.sessionStorage,
        },
      }
    )
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** Check sessionStorage for the persistence preference. Defaults to true (localStorage). */
function shouldPersistSession(): boolean {
  if (typeof window === 'undefined') return true
  return window.sessionStorage.getItem(PERSISTENCE_KEY) !== 'session'
}

/** Set the session persistence mode. When rememberMe is false, session data uses sessionStorage. */
export function setSessionPersistence(rememberMe: boolean) {
  if (typeof window === 'undefined') return
  if (rememberMe) {
    window.sessionStorage.removeItem(PERSISTENCE_KEY)
  } else {
    window.sessionStorage.setItem(PERSISTENCE_KEY, 'session')
  }
}

/** Clear all Supabase auth-related keys from localStorage. */
export function clearSupabaseLocalStorage() {
  if (typeof window === 'undefined') return
  const keysToRemove: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith('sb-') && key.includes('-auth-')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
}
