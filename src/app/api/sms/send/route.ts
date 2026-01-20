import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Twilio SMS sending

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface SendSMSRequest {
  to: string
  message: string
  userId?: string
}

export async function POST(request: Request) {
  try {
    // Two ways to authorize:
    // 1. Internal API key (for cron jobs/server calls)
    // 2. Authenticated user session (for user-initiated sends)

    const authHeader = request.headers.get('authorization')
    const internalApiKey = process.env.INTERNAL_API_KEY

    let isAuthorized = false
    let authenticatedUserId: string | null = null

    // Check for internal API key
    if (authHeader === `Bearer ${internalApiKey}` && internalApiKey) {
      isAuthorized = true
    }

    // Check for user session
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const supabaseAdmin = getSupabaseAdmin()
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        isAuthorized = true
        authenticatedUserId = user.id
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { to, message, userId } = await request.json() as SendSMSRequest

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Telefonnummer und Nachricht erforderlich' },
        { status: 400 }
      )
    }

    // Check if Twilio is configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.warn('Twilio not configured - SMS would be sent to:', to)
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'SMS würde gesendet werden (Twilio nicht konfiguriert)'
      })
    }

    // Dynamic import of Twilio to avoid issues if not installed
    try {
      const twilio = await import('twilio')
      const client = twilio.default(accountSid, authToken)

      // Format phone number (ensure it has country code)
      let formattedPhone = to.replace(/\s+/g, '').replace(/^0/, '+49')
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+49' + formattedPhone
      }

      const result = await client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: formattedPhone
      })

      return NextResponse.json({
        success: true,
        messageId: result.sid,
        status: result.status
      })
    } catch (twilioError: any) {
      console.error('Twilio error:', twilioError)
      return NextResponse.json(
        { error: 'Fehler beim Senden der SMS: ' + twilioError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('SMS send error:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
