import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getConsentHistory } from '@/lib/consent/manager'
import { emitStructuredError } from '@/lib/errors/structured-logger'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const history = await getConsentHistory(user.id)

    return NextResponse.json({ history })
  } catch (error) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Consent history error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/consent/history',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
