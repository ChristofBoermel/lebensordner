import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getTierFromSubscription, hasFeatureAccess } from '@/lib/subscription-tiers'
import FamilyDocumentViewClient from './client'

export const dynamic = 'force-dynamic'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PageProps {
  params: Promise<{ ownerId: string }>
}

export default async function FamilyDocumentViewPage({ params }: PageProps) {
  const { ownerId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's subscription info to check familyDashboard access
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

  const adminClient = getSupabaseAdmin()

  // Verify the user is a trusted person of the owner
  const { data: trustedPerson, error: tpError } = await adminClient
    .from('trusted_persons')
    .select('id')
    .eq('user_id', ownerId)
    .eq('linked_user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .single()

  if (tpError || !trustedPerson) {
    redirect('/vp-dashboard')
  }

  // Check owner's tier allows viewing
  const { data: ownerProfile } = await adminClient
    .from('profiles')
    .select('subscription_status, stripe_price_id')
    .eq('id', ownerId)
    .single()

  const ownerTier = getTierFromSubscription(
    ownerProfile?.subscription_status || null,
    ownerProfile?.stripe_price_id || null
  )

  // Only allow view for basic or premium tiers
  if (ownerTier.id === 'free') {
    redirect('/vp-dashboard')
  }

  return <FamilyDocumentViewClient ownerId={ownerId} />
}
