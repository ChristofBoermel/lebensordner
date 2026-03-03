import { createBrowserClient } from '@supabase/ssr'

const PERSISTENCE_KEY = 'supabase-persist-mode'

type RuntimePublicConfig = {
  supabaseUrl?: string
  supabaseAnonKey?: string
}

declare global {
  interface Window {
    __LEBENSORDNER_PUBLIC_CONFIG__?: RuntimePublicConfig
  }
}

export interface CreateClientOptions {
  persist?: boolean
}

function getSupabaseConfig() {
  const runtimeConfig =
    typeof window !== 'undefined'
      ? window.__LEBENSORDNER_PUBLIC_CONFIG__
      : undefined

  const supabaseUrl =
    runtimeConfig?.supabaseUrl?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    runtimeConfig?.supabaseAnonKey?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase client config is missing')
  }

  return { supabaseUrl, supabaseAnonKey }
}

type AuthErrorTelemetry = {
  error_type: 'client'
  error_message: string
  endpoint?: string
  pathname?: string
  href?: string
  release?: string
  source?: string
}

const AUTH_ERROR_THROTTLE_MS = 10_000

function getTelemetryKey(endpoint: string, status: number): string {
  return `lo_auth_err_${endpoint}_${status}`
}

function shouldSendAuthError(endpoint: string, status: number): boolean {
  if (typeof window === 'undefined') return false
  const key = getTelemetryKey(endpoint, status)
  const now = Date.now()
  const last = Number(window.sessionStorage.getItem(key) ?? '0')
  if (Number.isFinite(last) && now - last < AUTH_ERROR_THROTTLE_MS) {
    return false
  }
  window.sessionStorage.setItem(key, String(now))
  return true
}

function reportAuthFailure(endpoint: string, status: number): void {
  if (typeof window === 'undefined') return
  if (!shouldSendAuthError(endpoint, status)) return
  const payload: AuthErrorTelemetry = {
    error_type: 'client',
    error_message: `HTTP ${status} from Supabase request`,
    endpoint,
    pathname: window.location.pathname,
    href: window.location.href,
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.NEXT_PUBLIC_COMMIT_SHA,
    source: 'supabase_client',
  }

  fetch('/api/errors/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Telemetry failure must never break user flows.
  })
}

async function instrumentedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if ((response.status === 401 || response.status === 403) && typeof window !== 'undefined') {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    if (!rawUrl.includes('/api/errors/log')) {
      const endpoint = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl
      reportAuthFailure(endpoint, response.status)
    }
  }
  return response
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
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()

  if (!persist && typeof window !== 'undefined') {
    return createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          fetch: instrumentedFetch,
        },
        auth: {
          persistSession: true,
          storage: window.sessionStorage,
        },
      }
    )
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        fetch: instrumentedFetch,
      },
    }
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
