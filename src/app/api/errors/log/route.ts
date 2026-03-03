import { NextRequest, NextResponse } from 'next/server'
import { emitStructuredError, emitStructuredWarn } from '@/lib/errors/structured-logger'

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>

    const allowedErrorTypes = ['client', 'unhandled_rejection']
    const requestedType = toOptionalString(body.error_type)
    const error_type =
      requestedType && allowedErrorTypes.includes(requestedType) ? requestedType : 'client'

    const endpoint =
      toOptionalString(body.endpoint) ?? toOptionalString(body.pathname) ?? '/client'

    const error_message =
      toOptionalString(body.error_message) ?? 'Unknown client-side error reported'

    const stack = toOptionalString(body.component_stack) ?? toOptionalString(body.stack)
    const metadata: Record<string, string> = {}
    const href = toOptionalString(body.href)
    const pathname = toOptionalString(body.pathname)
    const userAgent = toOptionalString(body.user_agent)
    const release = toOptionalString(body.release)
    const source = toOptionalString(body.source)
    const clientTimestamp = toOptionalString(body.timestamp)

    if (href) metadata.href = href
    if (pathname) metadata.pathname = pathname
    if (userAgent) metadata.user_agent = userAgent
    if (release) metadata.release = release
    if (source) metadata.source = source
    if (clientTimestamp) metadata.client_timestamp = clientTimestamp

    if (!toOptionalString(body.error_message)) {
      emitStructuredWarn({
        event_type: 'client_error_log',
        event_message: 'Client error payload missing error_message; fallback message used',
        endpoint,
        metadata: {
          source: source ?? 'unknown',
        },
      })
    }

    emitStructuredError({
      error_type,
      error_message,
      error_id: toOptionalString(body.error_id),
      stack,
      endpoint,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    emitStructuredWarn({
      event_type: 'client_error_log',
      event_message: 'Rejected malformed client error payload',
      endpoint: '/api/errors/log',
      metadata: {
        reason: error instanceof Error ? error.message : 'invalid_json',
      },
    })
    return NextResponse.json({ received: false }, { status: 400 })
  }
}
