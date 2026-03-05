import { getRedis } from '../redis/client'
import { emitStructuredError } from '@/lib/errors/structured-logger'

// --- Interfaces ---

export interface RateLimitConfig {
  identifier: string
  endpoint: string
  maxRequests: number
  windowMs: number
  failMode?: 'open' | 'closed'
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  available: boolean
}

// --- Default limit constants ---
// These limits apply to both per-user and per-IP rate limiting.
// Intentional deviations from Core Flows §1.3 spec are documented inline.

export const RATE_LIMIT_LOGIN = { maxRequests: 5, windowMs: 15 * 60 * 1000 }
export const RATE_LIMIT_PASSWORD_RESET = { maxRequests: 5, windowMs: 60 * 60 * 1000 }
export const RATE_LIMIT_API = { maxRequests: 100, windowMs: 60 * 60 * 1000 }
export const RATE_LIMIT_UPLOAD = { maxRequests: 10, windowMs: 60 * 1000 } // 1 minute per product spec
export const RATE_LIMIT_2FA = { maxRequests: 5, windowMs: 15 * 60 * 1000 } // Not in spec, intentional: 5/15min for security
export const RATE_LIMIT_INVITE = { maxRequests: 5, windowMs: 60 * 60 * 1000 } // Matches spec: 5/hour
export const RATE_LIMIT_DOWNLOAD_LINK = { maxRequests: 10, windowMs: 60 * 60 * 1000 } // Not in spec, intentional: 10/hour

// --- Rate Limiting Functions ---

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const failMode = config.failMode ?? 'open'

  try {
    const redis = getRedis()
    const key = `rate:${config.endpoint}:${config.identifier}`
    const windowSec = Math.ceil(config.windowMs / 1000)

    // Atomic increment — also acts as the "increment" step
    const count = await redis.incr(key)

    // Set TTL only on the first request in the window
    if (count === 1) {
      await redis.expire(key, windowSec)
    }

    const ttl = await redis.ttl(key)
    const resetAt = new Date(Date.now() + Math.max(ttl, 0) * 1000)

    if (count > config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt, available: true }
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count,
      resetAt,
      available: true,
    }
  } catch (error) {
    emitStructuredError({
      error_type: 'security',
      error_message: `Rate limit check failed: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: config.endpoint,
      stack: error instanceof Error ? error.stack : undefined,
      metadata: {
        identifier: config.identifier,
        failMode,
      },
    })

    const failClosed = failMode === 'closed'
    return {
      allowed: !failClosed,
      remaining: failClosed ? 0 : config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMs),
      available: false,
    }
  }
}

// No-op: Redis INCR in checkRateLimit handles incrementing atomically.
// Kept for backward compatibility with existing callers.
export async function incrementRateLimit(_config: RateLimitConfig): Promise<void> {
  // Redis INCR in checkRateLimit handles this atomically
}

// No-op: Redis TTL handles automatic key expiry.
// Kept for backward compatibility with existing callers.
export async function cleanupExpiredLimits(): Promise<number> {
  // Redis handles TTL expiry automatically — no cleanup needed
  return 0
}
