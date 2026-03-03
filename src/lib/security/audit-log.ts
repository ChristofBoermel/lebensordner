import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { emitStructuredError } from '@/lib/errors/structured-logger'

// --- Interfaces ---

export interface AuditLogEvent {
  user_id?: string
  event_type: string
  event_data?: Record<string, unknown>
  request?: NextRequest
}

export type AuditLogResult =
  | { ok: true }
  | { ok: false; error: string }

// --- Event type constants ---

export const EVENT_LOGIN_SUCCESS = 'login_success'
export const EVENT_LOGIN_FAILURE = 'login_failure'
export const EVENT_PASSWORD_CHANGED = 'password_changed'
export const EVENT_PASSWORD_RESET_REQUESTED = 'password_reset_requested'
export const EVENT_TWO_FACTOR_ENABLED = 'two_factor_enabled'
export const EVENT_TWO_FACTOR_DISABLED = 'two_factor_disabled'
export const EVENT_TWO_FACTOR_VERIFIED = 'two_factor_verified'
export const EVENT_UNAUTHORIZED_ACCESS = 'unauthorized_access'
export const EVENT_ACCOUNT_LOCKED = 'account_locked'
export const EVENT_SUSPICIOUS_ACTIVITY = 'suspicious_activity'
export const EVENT_ADMIN_STATS_VIEWED = 'admin_stats_viewed'
export const EVENT_ADMIN_USERS_VIEWED = 'admin_users_viewed'
export const EVENT_ADMIN_ROLE_CHANGED = 'admin_role_changed'
export const EVENT_TRUSTED_PERSON_DOCUMENT_VIEWED = 'trusted_person_document_viewed'
export const EVENT_DOWNLOAD_LINK_CREATED = 'download_link_created'
export const EVENT_DOWNLOAD_LINK_VIEWED = 'download_link_viewed'
export const EVENT_GDPR_EXPORT_REQUESTED = 'gdpr_export_requested'
export const EVENT_VAULT_UNLOCKED_BIOMETRIC = 'vault_unlocked_biometric'
export const EVENT_DOCUMENT_VIEWED = 'document_viewed'
export const EVENT_DOCUMENT_DOWNLOADED = 'document_downloaded'
export const EVENT_DOCUMENT_LOCKED = 'document_locked'
export const EVENT_DOCUMENT_UNLOCKED = 'document_unlocked'
export const EVENT_CATEGORY_LOCKED = 'category_locked'
export const EVENT_CATEGORY_UNLOCKED = 'category_unlocked'

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env['SUPABASE_URL']!,
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

export async function logSecurityEvent(event: AuditLogEvent): Promise<AuditLogResult> {
  try {
    const supabase = createServiceClient()

    const forwarded = event.request?.headers.get('x-forwarded-for') || ''
    const ip = forwarded.split(',')[0]?.trim() || null
    const maskedIp = ip ? maskIpAddress(ip) : null
    const userAgent = extractUserAgent(event.request)

    const { error } = await supabase
      .from('security_audit_log')
      .insert({
        user_id: event.user_id || null,
        event_type: event.event_type,
        event_data: event.event_data || null,
        ip_address: maskedIp,
        user_agent: userAgent,
      })

    if (error) {
      const message = error.message || 'Unknown Supabase insert error'
      emitStructuredError({
        error_type: 'audit',
        error_message: `Failed to persist security audit event: ${message}`,
        endpoint: 'lib/security/audit-log',
      })
      return { ok: false, error: message }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitStructuredError({
      error_type: 'audit',
      error_message: `Failed to persist security audit event: ${message}`,
      endpoint: 'lib/security/audit-log',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return { ok: false, error: message }
  }
}
