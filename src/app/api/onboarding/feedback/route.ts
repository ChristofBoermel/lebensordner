import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    const body = await request.json() as OnboardingFeedbackRequest

    const { stepName, clarityRating, wasHelpful, comments, timeSpentSeconds } = body

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

    const { data: feedback, error: dbError } = await getSupabaseAdmin()
      .from('onboarding_feedback')
      .insert({
        user_id: user?.id || null,
        step_name: stepName,
        clarity_rating: clarityRating,
        was_helpful: wasHelpful ?? null,
        comments: comments || null,
        time_spent_seconds: timeSpentSeconds ?? null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Fehler beim Speichern des Feedbacks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    })
  } catch (error) {
    console.error('Onboarding feedback error:', error)
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
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden des Feedbacks' },
        { status: 500 }
      )
    }

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Onboarding feedback GET error:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
