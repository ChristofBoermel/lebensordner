import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { emitStructuredError } from '@/lib/errors/structured-logger'
import { getStripePriceIds } from '@/lib/subscription-tiers'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const priceId = typeof body?.priceId === 'string' ? body.priceId.trim() : ''
    if (!priceId) return NextResponse.json({ error: 'priceId required' }, { status: 400 })

    const configuredPriceIds = getStripePriceIds()
    const allowedPriceIds = new Set(
      [
        configuredPriceIds.basic.monthly,
        configuredPriceIds.basic.yearly,
        configuredPriceIds.premium.monthly,
        configuredPriceIds.premium.yearly,
      ].filter((id): id is string => Boolean(id))
    )

    if (!allowedPriceIds.has(priceId)) {
      return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 10,
    })

    const activeSub = subscriptions.data.find(
      (subscription) => subscription.status === 'active' || subscription.status === 'trialing'
    )

    if (!activeSub) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    const subscriptionItemId = activeSub.items.data[0]?.id
    if (!subscriptionItemId) {
      return NextResponse.json({ error: 'Subscription item not found' }, { status: 400 })
    }

    await stripe.subscriptions.update(activeSub.id, {
      items: [{ id: subscriptionItemId, price: priceId }],
      proration_behavior: 'create_prorations',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    emitStructuredError({
      error_type: 'api',
      error_message: `Stripe upgrade error: ${error?.message ?? String(error)}`,
      endpoint: '/api/stripe/upgrade',
      stack: error?.stack,
    })

    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Abonnements' },
      { status: 500 }
    )
  }
}
