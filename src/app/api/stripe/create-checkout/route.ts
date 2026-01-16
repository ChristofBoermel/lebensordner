import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe, SUBSCRIPTION_PRICE_ID } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    // Get price ID from request body or use default
    let priceId = SUBSCRIPTION_PRICE_ID
    try {
      const body = await request.json()
      if (body.priceId) {
        priceId = body.priceId
      }
    } catch {
      // No body or invalid JSON, use default price
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email, full_name')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${request.headers.get('origin')}/abo?success=true`,
      cancel_url: `${request.headers.get('origin')}/abo?canceled=true`,
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          supabase_user_id: user.id,
        },
      },
      locale: 'de',
      allow_promotion_codes: true,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Erstellen der Checkout-Session' },
      { status: 500 }
    )
  }
}
