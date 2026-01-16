import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Create Supabase admin client on demand
const getSupabaseAdmin = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id || 
                       session.subscription 
                         ? (await stripe.subscriptions.retrieve(session.subscription as string)).metadata?.supabase_user_id 
                         : null

        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as Stripe.Subscription
          const priceId = subscription.items.data[0]?.price?.id || null
          
          await getSupabaseAdmin()
            .from('profiles')
            .update({
              stripe_subscription_id: subscription.id,
              stripe_price_id: priceId,
              subscription_status: subscription.status,
              subscription_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = (subscription as any).metadata?.supabase_user_id
        const priceId = subscription.items.data[0]?.price?.id || null

        if (userId) {
          await getSupabaseAdmin()
            .from('profiles')
            .update({
              stripe_price_id: priceId,
              subscription_status: subscription.status,
              subscription_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            })
            .eq('id', userId)
        } else {
          // Try to find user by customer ID
          const { data: profile } = await getSupabaseAdmin()
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', subscription.customer as string)
            .single()

          if (profile) {
            await getSupabaseAdmin()
              .from('profiles')
              .update({
                stripe_subscription_id: subscription.id,
                stripe_price_id: priceId,
                subscription_status: subscription.status,
                subscription_current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
              })
              .eq('id', profile.id)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Find user by subscription ID
        const { data: profile } = await getSupabaseAdmin()
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (profile) {
          await getSupabaseAdmin()
            .from('profiles')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              stripe_price_id: null,
            })
            .eq('id', profile.id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription
        
        if (subscriptionId) {
          const { data: profile } = await getSupabaseAdmin()
            .from('profiles')
            .select('id, email')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (profile) {
            await getSupabaseAdmin()
              .from('profiles')
              .update({ subscription_status: 'past_due' })
              .eq('id', profile.id)
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
