import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// --- Interfaces ---

export interface AuditLogEvent {
  user_id?: string
  event_type: string
  event_data?: Record<string, unknown>
  request?: NextRequest
}

// --- Event type constants ---

export const EVENT_LOGIN_SUCCESS = 'login_success'
export const EVENT_LOGIN_FAILURE = 'login_failure'
export const EVENT_PASSWORD_CHANGED = 'password_changed'
export const EVENT_PASSWORD_RESET_REQUESTED = 'password_reset_requested'
export const EVENT_TWO_FACTOR_ENABLED = 'two_factor_enabled'
export const EVENT_TWO_FACTOR_DISABLED = 'two_factor_disabled'
export const EVENT_UNAUTHORIZED_ACCESS = 'unauthorized_access'
export const EVENT_ACCOUNT_LOCKED = 'account_locked'
export const EVENT_SUSPICIOUS_ACTIVITY = 'suspicious_activity'

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// --- Functions ---

export function maskIpAddress(ip: string): string {
  if (!ip) return 'Unknown'

  // IPv6
  if (ip.includes(':')) {
    const segments = ip.split(':')
    if (segments.length >= 4) {
      return segments.slice(0, -4).concat(['xxxx', 'xxxx', 'xxxx', 'xxxx']).join(':')
    }
    return segments.slice(0, -1).concat(['xxxx']).join(':')
  }

  // IPv4
  const octets = ip.split('.')
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.${octets[2]}.xxx`
  }

  return 'Unknown'
}

export function extractUserAgent(request?: NextRequest): string {
  return request?.headers.get('user-agent') || 'Unknown'
}

export async function logSecurityEvent(event: AuditLogEvent): Promise<void> {
  try {
    const supabase = createServiceClient()

    const forwarded = event.request?.headers.get('x-forwarded-for') || ''
    const ip = forwarded.split(',')[0]?.trim() || event.request?.ip || null
    const maskedIp = ip ? maskIpAddress(ip) : null
    const userAgent = extractUserAgent(event.request)

    await supabase
      .from('security_audit_log')
      .insert({
        user_id: event.user_id || null,
        event_type: event.event_type,
        event_data: event.event_data || null,
        ip_address: maskedIp,
        user_agent: userAgent,
      })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}
