import { createClient } from '@supabase/supabase-js'

// --- Interfaces ---

export interface RateLimitConfig {
  identifier: string
  endpoint: string
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

// --- Default limit constants ---
// These limits apply to both per-user and per-IP rate limiting.
// Intentional deviations from Core Flows §1.3 spec are documented inline.

export const RATE_LIMIT_LOGIN = { maxRequests: 5, windowMs: 15 * 60 * 1000 }
export const RATE_LIMIT_PASSWORD_RESET = { maxRequests: 3, windowMs: 60 * 60 * 1000 }
export const RATE_LIMIT_API = { maxRequests: 100, windowMs: 60 * 60 * 1000 }
export const RATE_LIMIT_UPLOAD = { maxRequests: 10, windowMs: 60 * 1000 } // 1 minute per product spec
export const RATE_LIMIT_2FA = { maxRequests: 5, windowMs: 15 * 60 * 1000 } // Not in spec, intentional: 5/15min for security
export const RATE_LIMIT_INVITE = { maxRequests: 5, windowMs: 60 * 60 * 1000 } // Matches spec: 5/hour
export const RATE_LIMIT_DOWNLOAD_LINK = { maxRequests: 10, windowMs: 60 * 60 * 1000 } // Not in spec, intentional: 10/hour

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// --- Rate Limiting Functions ---

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient()
    const now = new Date()
    const windowStart = new Date(now.getTime() - config.windowMs)

    const { data, error } = await supabase
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('identifier', config.identifier)
      .eq('endpoint', config.endpoint)
      .gte('window_start', windowStart.toISOString())
      .order('window_start', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now.getTime() + config.windowMs),
      }
    }

    const resetAt = new Date(new Date(data.window_start).getTime() + config.windowMs)

    if (data.request_count >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt }
    }

    return {
      allowed: true,
      remaining: config.maxRequests - data.request_count - 1,
      resetAt,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMs),
    }
  }
}

export async function incrementRateLimit(config: RateLimitConfig): Promise<void> {
  try {
    const supabase = createServiceClient()
    const now = new Date()
    const windowStart = new Date(now.getTime() - config.windowMs)

    // Check for existing record in current window
    const { data: existing } = await supabase
      .from('rate_limits')
      .select('id, request_count')
      .eq('identifier', config.identifier)
      .eq('endpoint', config.endpoint)
      .gte('window_start', windowStart.toISOString())
      .order('window_start', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      await supabase
        .from('rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('rate_limits')
        .insert({
          identifier: config.identifier,
          endpoint: config.endpoint,
          request_count: 1,
          window_start: now.toISOString(),
        })
    }
  } catch (error) {
    console.error('Rate limit increment failed:', error)
  }
}

export async function cleanupExpiredLimits(): Promise<number> {
  try {
    const supabase = createServiceClient()
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Count entries that will be deleted
    const { count } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .lt('window_start', cutoff.toISOString())

    await supabase
      .from('rate_limits')
      .delete()
      .lt('window_start', cutoff.toISOString())

    return count ?? 0
  } catch (error) {
    console.error('Rate limit cleanup failed:', error)
    return 0
  }
}
