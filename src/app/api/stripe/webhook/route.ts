import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Force dynamic to prevent any caching/redirect issues
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

// Safe date conversion helper
function safeTimestampToISO(timestamp: number | null | undefined): string | null {
  if (!timestamp || typeof timestamp !== 'number') {
    return null
  }
  try {
    return new Date(timestamp * 1000).toISOString()
  } catch {
    return null
  }
}

// Helper to find user by various identifiers
async function findUserProfile(
  customerId?: string | null,
  subscriptionId?: string | null,
  metadata?: Record<string, string> | null
) {
  const supabase = getSupabaseAdmin()
  
  // Try metadata first
  if (metadata?.supabase_user_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', metadata.supabase_user_id)
      .single()
    if (data) return data.id
  }
  
  // Try by customer ID
  if (customerId) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()
    if (data) return data.id
  }
  
  // Try by subscription ID
  if (subscriptionId) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .single()
    if (data) return data.id
  }
  
  return null
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

  console.log('Webhook received:', event.type)

  try {
    const supabase = getSupabaseAdmin()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Checkout session completed:', session.id)
        console.log('Customer:', session.customer)
        console.log('Subscription:', session.subscription)
        
        // Get subscription details
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const priceId = subscription.items.data[0]?.price?.id || null
          const periodEnd = safeTimestampToISO((subscription as any).current_period_end)
          
          console.log('Subscription details:', {
            id: subscription.id,
            status: subscription.status,
            priceId,
            periodEnd
          })
          
          // Find user
          const userId = await findUserProfile(
            session.customer as string,
            subscription.id,
            subscription.metadata as Record<string, string>
          )
          
          console.log('Found user ID:', userId)
          
          if (userId) {
            const updateData: Record<string, any> = {
              stripe_subscription_id: subscription.id,
              stripe_price_id: priceId,
              subscription_status: subscription.status,
            }
            
            if (periodEnd) {
              updateData.subscription_current_period_end = periodEnd
            }
            
            const { error } = await supabase
              .from('profiles')
              .update(updateData)
              .eq('id', userId)
            
            if (error) {
              console.error('Failed to update profile:', error)
            } else {
              console.log('Profile updated successfully')
            }
          } else {
            console.error('Could not find user for checkout session')
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price?.id || null
        const periodEnd = safeTimestampToISO((subscription as any).current_period_end)
        
        console.log('Subscription event:', event.type)
        console.log('Subscription:', subscription.id, 'status:', subscription.status)

        const userId = await findUserProfile(
          subscription.customer as string,
          subscription.id,
          subscription.metadata as Record<string, string>
        )
        
        console.log('Found user ID:', userId)

        if (userId) {
          const updateData: Record<string, any> = {
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            subscription_status: subscription.status,
          }
          
          if (periodEnd) {
            updateData.subscription_current_period_end = periodEnd
          }
          
          const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
          
          if (error) {
            console.error('Failed to update subscription:', error)
          } else {
            console.log('Subscription updated successfully')
          }
        } else {
          console.error('Could not find user for subscription:', subscription.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        const userId = await findUserProfile(
          subscription.customer as string,
          subscription.id,
          subscription.metadata as Record<string, string>
        )

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              stripe_price_id: null,
            })
            .eq('id', userId)
          
          console.log('Subscription canceled for user:', userId)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        console.log('Payment succeeded for invoice:', invoice.id)
        
        if ((invoice as any).subscription) {
          const userId = await findUserProfile(
            invoice.customer as string,
            (invoice as any).subscription as string,
            null
          )

          if (userId) {
            await supabase
              .from('profiles')
              .update({ subscription_status: 'active' })
              .eq('id', userId)
            
            console.log('User status updated to active:', userId)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        
        if ((invoice as any).subscription) {
          const userId = await findUserProfile(
            invoice.customer as string,
            (invoice as any).subscription as string,
            null
          )

          if (userId) {
            await supabase
              .from('profiles')
              .update({ subscription_status: 'past_due' })
              .eq('id', userId)
            
            console.log('User status updated to past_due:', userId)
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler error:', error.message || error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
