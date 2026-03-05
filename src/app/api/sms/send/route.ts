import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { logSecurityEvent } from '@/lib/security/audit-log'
import { emitStructuredError, emitStructuredInfo, emitStructuredWarn } from '@/lib/errors/structured-logger'

interface SendSMSRequest {
  to: string
  message: string
  userId?: string
}

const IP_RATE_LIMIT = { maxRequests: 10, windowMs: 10 * 60 * 1000 }
const ACTOR_RATE_LIMIT = { maxRequests: 30, windowMs: 60 * 60 * 1000 }

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || '127.0.0.1'
}

function isInternalServiceRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const internalApiKey = process.env.INTERNAL_API_KEY
  return Boolean(internalApiKey && authHeader === `Bearer ${internalApiKey}`)
}

function normalizePhone(phone: string): string {
  let formattedPhone = phone.replace(/\s+/g, '').replace(/^0/, '+49')
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = `+49${formattedPhone}`
  }
  return formattedPhone
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request)

  try {
    if (!isInternalServiceRequest(request)) {
      await logSecurityEvent({
        event_type: 'sms_send_rejected',
        event_data: { reason: 'unauthorized', endpoint: '/api/sms/send' },
        request: request as any,
      })
      emitStructuredWarn({
        event_type: 'security',
        event_message: 'Rejected non-internal SMS send request',
        endpoint: '/api/sms/send',
        metadata: { clientIp },
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as SendSMSRequest
    const { to, message, userId } = body
    const actor = userId || 'internal-service'

    await logSecurityEvent({
      user_id: userId || undefined,
      event_type: 'sms_send_attempt',
      event_data: { actor, endpoint: '/api/sms/send' },
      request: request as any,
    })

    if (!to || !message) {
      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_rejected',
        event_data: { actor, reason: 'missing_required_fields' },
        request: request as any,
      })
      return NextResponse.json(
        { error: 'Telefonnummer und Nachricht erforderlich' },
        { status: 400 },
      )
    }

    const ipLimit = await checkRateLimit({
      identifier: `sms_send_ip:${clientIp}`,
      endpoint: '/api/sms/send',
      failMode: 'closed',
      ...IP_RATE_LIMIT,
    })

    if (ipLimit.available === false) {
      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_rejected',
        event_data: { actor, reason: 'rate_limiter_unavailable_ip' },
        request: request as any,
      })
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      )
    }

    if (!ipLimit.allowed) {
      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_rejected',
        event_data: { actor, reason: 'rate_limited_ip' },
        request: request as any,
      })
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const actorLimit = await checkRateLimit({
      identifier: `sms_send_actor:${actor}`,
      endpoint: '/api/sms/send',
      failMode: 'closed',
      ...ACTOR_RATE_LIMIT,
    })

    if (actorLimit.available === false) {
      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_rejected',
        event_data: { actor, reason: 'rate_limiter_unavailable_actor' },
        request: request as any,
      })
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      )
    }

    if (!actorLimit.allowed) {
      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_rejected',
        event_data: { actor, reason: 'rate_limited_actor' },
        request: request as any,
      })
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
    const twilioSenderId = process.env.TWILIO_SENDER_ID
    if (!accountSid || !authToken || (!twilioPhoneNumber && !twilioSenderId)) {
      emitStructuredInfo({
        event_type: 'security',
        event_message: 'Twilio is not configured; simulated SMS send response returned',
        endpoint: '/api/sms/send',
        metadata: { actor },
      })
      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_simulated',
        event_data: { actor },
        request: request as any,
      })
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'SMS würde gesendet werden (Twilio nicht konfiguriert)',
      })
    }

    try {
      const twilio = await import('twilio')
      const client = twilio.default(accountSid, authToken)
      const formattedPhone = normalizePhone(to)

      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_SENDER_ID || twilioPhoneNumber,
        to: formattedPhone,
      })

      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_success',
        event_data: { actor, providerMessageId: result.sid },
        request: request as any,
      })

      return NextResponse.json({
        success: true,
        messageId: result.sid,
        status: result.status,
      })
    } catch (twilioError: any) {
      await logSecurityEvent({
        user_id: userId || undefined,
        event_type: 'sms_send_failure',
        event_data: { actor, reason: twilioError?.code || 'twilio_error' },
        request: request as any,
      })
      emitStructuredError({
        error_type: 'notification',
        error_message: `Twilio error: ${twilioError?.message ?? String(twilioError)}`,
        endpoint: '/api/sms/send',
        stack: twilioError?.stack,
      })
      return NextResponse.json(
        { error: `Fehler beim Senden der SMS: ${twilioError.message}` },
        { status: 500 },
      )
    }
  } catch (error: any) {
    await logSecurityEvent({
      event_type: 'sms_send_failure',
      event_data: { reason: 'unhandled_exception' },
      request: request as any,
    })
    emitStructuredError({
      error_type: 'api',
      error_message: `SMS send error: ${error?.message ?? String(error)}`,
      endpoint: '/api/sms/send',
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 },
    )
  }
}
