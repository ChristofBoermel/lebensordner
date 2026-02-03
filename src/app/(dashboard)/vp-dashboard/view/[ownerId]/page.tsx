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
    console.log('[VP Dashboard View] No user found, redirecting to login')
    redirect('/login')
  }

  console.log('[VP Dashboard View] User:', user.id, 'attempting to view owner:', ownerId)

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
    console.log('[VP Dashboard View] User lacks familyDashboard access, redirecting to upgrade')
    redirect('/abo?upgrade=familyDashboard')
  }

  const adminClient = getSupabaseAdmin()

  // Verify the owner account exists and is active
  const { data: ownerProfile, error: ownerError } = await adminClient
    .from('profiles')
    .select('id, subscription_status, stripe_price_id')
    .eq('id', ownerId)
    .single()

  if (ownerError || !ownerProfile) {
    console.error('[VP Dashboard View] Owner not found:', { ownerId, error: ownerError?.message })
    redirect('/vp-dashboard?error=owner_not_found')
  }

  // Verify the user is a trusted person of the owner
  const { data: trustedPerson, error: tpError } = await adminClient
    .from('trusted_persons')
    .select('id, invitation_status, is_active')
    .eq('user_id', ownerId)
    .eq('linked_user_id', user.id)
    .single()

  if (tpError || !trustedPerson) {
    console.error('[VP Dashboard View] No trusted person relationship:', {
      ownerId,
      userId: user.id,
      error: tpError?.message
    })
    redirect('/vp-dashboard?error=no_relationship')
  }

  // Check relationship status for specific error redirects
  if (trustedPerson.invitation_status !== 'accepted') {
    console.log('[VP Dashboard View] Invitation not accepted:', {
      ownerId,
      userId: user.id,
      status: trustedPerson.invitation_status
    })
    redirect('/vp-dashboard?error=invitation_pending')
  }

  if (!trustedPerson.is_active) {
    console.log('[VP Dashboard View] Relationship inactive:', {
      ownerId,
      userId: user.id
    })
    redirect('/vp-dashboard?error=relationship_inactive')
  }

  // Check owner's tier allows viewing
  const ownerTier = getTierFromSubscription(
    ownerProfile.subscription_status || null,
    ownerProfile.stripe_price_id || null
  )

  console.log('[VP Dashboard View] Owner tier:', ownerTier.id)

  // Only allow view for basic or premium tiers
  if (ownerTier.id === 'free') {
    console.log('[VP Dashboard View] Owner has free tier, redirecting')
    redirect('/vp-dashboard?error=owner_free_tier')
  }

  console.log('[VP Dashboard View] Access granted for user:', user.id, 'to view owner:', ownerId)

  return <FamilyDocumentViewClient ownerId={ownerId} />
}
