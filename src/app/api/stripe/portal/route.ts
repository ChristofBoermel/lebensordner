import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { emitStructuredError } from '@/lib/errors/structured-logger'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Kein Stripe-Konto gefunden' },
        { status: 400 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${request.headers.get('origin')}/abo`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Stripe portal error: ${error?.message ?? String(error)}`,
      endpoint: '/api/stripe/portal',
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: error.message || 'Fehler beim Öffnen des Kundenportals' },
      { status: 500 }
    )
  }
}
