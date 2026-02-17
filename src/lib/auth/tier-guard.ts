import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
    SUBSCRIPTION_TIERS,
    SubscriptionTier,
    getTierFromSubscription,
    TierConfig,
    hasFeatureAccess
} from '@/lib/subscription-tiers'

export async function getUserTier(): Promise<TierConfig> {
    const supabase = await createServerSupabaseClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return SUBSCRIPTION_TIERS.free
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, stripe_price_id') // Adjust based on schema
        .eq('id', user.id)
        .single()

    // Fallback if no profile
    if (!profile) return SUBSCRIPTION_TIERS.free

    return getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
}

export async function requireFeature(
    feature: keyof TierConfig['limits']
) {
    const supabase = await createServerSupabaseClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const tier = await getUserTier()

    if (!hasFeatureAccess(tier, feature)) {
        redirect(`/abo?upgrade=${String(feature)}`)
    }

    return { user, tier }
}
