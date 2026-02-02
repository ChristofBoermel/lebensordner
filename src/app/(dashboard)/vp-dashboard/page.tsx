import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getTierFromSubscription, hasFeatureAccess } from '@/lib/subscription-tiers'
import FamilienUebersichtClientPage from './client'

export const dynamic = 'force-dynamic'

export default async function FamilienUebersichtPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's subscription info
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, stripe_price_id')
    .eq('id', user.id)
    .single()

  const tier = getTierFromSubscription(
    profile?.subscription_status || null,
    profile?.stripe_price_id || null
  )

  // Require familyDashboard feature
  if (!hasFeatureAccess(tier, 'familyDashboard')) {
    redirect('/abo?upgrade=familyDashboard')
  }

  return <FamilienUebersichtClientPage />
}
