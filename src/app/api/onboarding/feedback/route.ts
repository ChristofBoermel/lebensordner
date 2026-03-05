import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { logSecurityEvent } from '@/lib/security/audit-log'
import { emitStructuredError } from '@/lib/errors/structured-logger'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

interface OnboardingFeedbackRequest {
  stepName: string
  clarityRating: number
  wasHelpful?: boolean
  comments?: string
  timeSpentSeconds?: number
}

const VALID_STEPS = ['welcome', 'profile', 'documents', 'emergency', 'complete']
const MAX_COMMENT_LENGTH = 500

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    const body = await request.json() as OnboardingFeedbackRequest
    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    const { stepName, clarityRating, wasHelpful, comments, timeSpentSeconds } = body

    if (!user) {
      await logSecurityEvent({
        event_type: 'onboarding_feedback_rejected',
        event_data: { reason: 'unauthenticated' },
        request: request as any,
      })
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const ipLimit = await checkRateLimit({
      identifier: `onboarding_feedback_ip:${clientIp}`,
      endpoint: '/api/onboarding/feedback',
      maxRequests: 20,
      windowMs: 60 * 60 * 1000,
      failMode: 'closed',
    })
    if (ipLimit.available === false) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const userLimit = await checkRateLimit({
      identifier: `onboarding_feedback_user:${user.id}`,
      endpoint: '/api/onboarding/feedback',
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
      failMode: 'closed',
    })
    if (userLimit.available === false) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }
    if (!userLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    // Validate required fields
    if (!stepName || !VALID_STEPS.includes(stepName)) {
      return NextResponse.json(
        { error: 'Ungültiger Schrittname' },
        { status: 400 }
      )
    }

    if (!clarityRating || clarityRating < 1 || clarityRating > 5) {
      return NextResponse.json(
        { error: 'Bewertung muss zwischen 1 und 5 liegen' },
        { status: 400 }
      )
    }

    if (typeof comments === 'string' && comments.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Kommentar darf maximal ${MAX_COMMENT_LENGTH} Zeichen enthalten` },
        { status: 400 }
      )
    }

    const { data: feedback, error: dbError } = await getSupabaseAdmin()
      .from('onboarding_feedback')
      .insert({
        user_id: user.id,
        step_name: stepName,
        clarity_rating: clarityRating,
        was_helpful: wasHelpful ?? null,
        comments: comments || null,
        time_spent_seconds: timeSpentSeconds ?? null,
      })
      .select()
      .single()

    if (dbError) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Onboarding feedback database error: ${dbError.message}`,
        endpoint: '/api/onboarding/feedback',
      })
      return NextResponse.json(
        { error: 'Fehler beim Speichern des Feedbacks' },
        { status: 500 }
      )
    }

    await logSecurityEvent({
      user_id: user.id,
      event_type: 'onboarding_feedback_submitted',
      event_data: { stepName },
      request: request as any,
    })

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Onboarding feedback error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/onboarding/feedback',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const { data: feedback, error } = await getSupabaseAdmin()
      .from('onboarding_feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      emitStructuredError({
        error_type: 'api',
        error_message: `Onboarding feedback query error: ${error.message}`,
        endpoint: '/api/onboarding/feedback',
      })
      return NextResponse.json(
        { error: 'Fehler beim Laden des Feedbacks' },
        { status: 500 }
      )
    }

    return NextResponse.json({ feedback })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Onboarding feedback GET error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/onboarding/feedback',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
