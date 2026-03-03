import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  EVENT_CATEGORY_LOCKED,
  EVENT_CATEGORY_UNLOCKED,
  EVENT_DOCUMENT_DOWNLOADED,
  EVENT_DOCUMENT_LOCKED,
  EVENT_DOCUMENT_UNLOCKED,
  EVENT_DOCUMENT_VIEWED,
  EVENT_VAULT_UNLOCKED_BIOMETRIC,
  logSecurityEvent,
} from '@/lib/security/audit-log'
import { emitStructuredError, emitStructuredInfo, emitStructuredWarn } from '@/lib/errors/structured-logger'
import { resolveAuthenticatedUser } from '@/lib/auth/resolve-authenticated-user'

interface AuditRequestBody {
  event_type?: unknown
  document_id?: string
  document_title?: string
  category_key?: string
  event_data?: unknown
}

const ALLOWED_EVENTS = new Set([
  EVENT_VAULT_UNLOCKED_BIOMETRIC,
  EVENT_DOCUMENT_VIEWED,
  EVENT_DOCUMENT_DOWNLOADED,
  EVENT_DOCUMENT_LOCKED,
  EVENT_DOCUMENT_UNLOCKED,
  EVENT_CATEGORY_LOCKED,
  EVENT_CATEGORY_UNLOCKED,
])

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      '/api/documents/audit'
    )

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const body = (await request.json()) as AuditRequestBody
    const eventType =
      typeof body?.event_type === 'string' ? body.event_type.trim() : ''

    if (!ALLOWED_EVENTS.has(eventType)) {
      emitStructuredWarn({
        event_type: 'audit',
        event_message: 'Rejected unsupported documents audit event',
        endpoint: '/api/documents/audit',
        metadata: { eventType },
      })
      return NextResponse.json({ error: 'Ungültiges Audit-Event' }, { status: 400 })
    }

    const mappedEventData: Record<string, string> = {}
    if (typeof body.document_id === 'string' && body.document_id.length > 0) {
      mappedEventData.document_id = body.document_id
    }
    if (typeof body.document_title === 'string' && body.document_title.length > 0) {
      mappedEventData.document_title = body.document_title
    }
    if (typeof body.category_key === 'string' && body.category_key.length > 0) {
      mappedEventData.category_key = body.category_key
    }

    const requestEventData =
      body.event_data && typeof body.event_data === 'object' && !Array.isArray(body.event_data)
        ? Object.entries(body.event_data as Record<string, unknown>).reduce<Record<string, string>>(
            (acc, [key, value]) => {
              if (typeof value !== 'string') return acc
              const trimmed = value.trim()
              if (trimmed.length === 0) return acc
              acc[key] = trimmed
              return acc
            },
            {},
          )
        : {}

    const mergedEventData = {
      ...requestEventData,
      ...mappedEventData,
    }

    const result = await logSecurityEvent({
      user_id: user.id,
      event_type: eventType,
      event_data: Object.keys(mergedEventData).length > 0 ? mergedEventData : undefined,
      request,
    })

    if (result.ok) {
      emitStructuredInfo({
        event_type: 'audit',
        event_message: 'Documents audit event stored',
        endpoint: '/api/documents/audit',
        metadata: { eventType },
      })
    } else {
      emitStructuredError({
        error_type: 'audit',
        error_message: `Failed to persist documents audit event: ${result.error}`,
        endpoint: '/api/documents/audit',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Documents audit POST error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/documents/audit',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
