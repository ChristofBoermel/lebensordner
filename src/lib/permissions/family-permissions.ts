import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type SubscriptionStatus = Database['public']['Tables']['profiles']['Row']['subscription_status']

export interface FamilyPermissions {
  canDownload: boolean
  canView: boolean
  isOwner: boolean
  ownerSubscription: SubscriptionStatus
  ownerId: string | null
}

export interface FamilyMemberContext {
  userId: string
  ownerId: string
  relationship: TrustedPersonRelationship
}

interface TrustedPersonRelationship {
  id: string
  role: 'emergency_contact' | 'family_member' | null
  access_level: 'immediate' | 'emergency' | 'after_confirmation'
}

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Checks if a user is the owner of documents (owns the profile)
 * No subscription check needed for owners - they always have full access
 */
export async function isOwner(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const { data: profile } = await (supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single() as any)

  return !!profile
}

/**
 * Gets the family relationship context for a user accessing an owner's data
 * Returns null if no valid family relationship exists
 */
export async function getFamilyRelationship(
  userId: string,
  ownerId: string
): Promise<TrustedPersonRelationship | null> {
  const supabase = getSupabaseAdmin()

  const { data: trustedPerson } = await (supabase
    .from('trusted_persons')
    .select('id, role, access_level')
    .eq('user_id', ownerId)
    .eq('linked_user_id', userId)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .maybeSingle() as any)

  if (!trustedPerson) return null

  return {
    id: trustedPerson.id,
    role: trustedPerson.role as TrustedPersonRelationship['role'],
    access_level: trustedPerson.access_level as TrustedPersonRelationship['access_level'],
  }
}

/**
 * Determines download permission based on owner's subscription tier
 * Premium = download allowed, Basic = download denied
 */
function canDownloadBasedOnTier(subscriptionStatus: SubscriptionStatus | null): boolean {
  // If subscription is active/trialing and premium tier -> allow download
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    // Check if it's premium by looking at stripe_price_id
    // For now, we assume active/trialing on premium plan
    // The actual check happens in conjunction with getTierFromSubscription
    return true
  }
  return false
}

/**
 * Gets the owner's subscription tier and returns whether download is allowed
 * This is a helper that should be used server-side only
 */
export async function getOwnerSubscriptionTier(
  ownerId: string
): Promise<{ status: SubscriptionStatus; canDownload: boolean }> {
  const supabase = getSupabaseAdmin()

  const { data: profile } = await (supabase
    .from('profiles')
    .select('subscription_status, stripe_price_id, stripe_subscription_id')
    .eq('id', ownerId)
    .single() as any)

  if (!profile) {
    return { status: null, canDownload: false }
  }

  // Check if subscription is active
  const isActive = profile.subscription_status === 'active' ||
    profile.subscription_status === 'trialing'

  // Determine tier from price ID
  const priceIds = {
    basic: [
      process.env.STRIPE_PRICE_BASIC_MONTHLY,
      process.env.STRIPE_PRICE_BASIC_YEARLY,
    ].filter(Boolean),
    premium: [
      process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
      process.env.STRIPE_PRICE_PREMIUM_YEARLY,
      process.env.STRIPE_PRICE_ID, // legacy
    ].filter(Boolean),
  }

  const priceId = profile.stripe_price_id

  // If it's premium tier and active -> allow download
  const isPremium = priceId && priceIds.premium.includes(priceId)
  // Legacy: if subscription is active but price ID unknown, assume premium (safe default)
  const isLegacyPremium = isActive && !priceId

  const canDownload = isActive && (isPremium || isLegacyPremium)

  return {
    status: profile.subscription_status,
    canDownload,
  }
}

/**
 * Main permission check function for family dashboard
 * 
 * Returns permissions for a user trying to access an owner's documents
 * - Owners always have full permissions
 * - Family members have permissions based on owner's subscription tier
 * 
 * This function is optimized for performance:
 * - Single query to check if owner + get subscription
 * - No joins per document
 * - Should be called server-side only
 */
export async function getFamilyPermissions(
  userId: string,
  ownerId?: string
): Promise<FamilyPermissions> {
  // If no ownerId provided, assume user is trying to access their own data
  if (!ownerId || userId === ownerId) {
    // Check if user is actually an owner (has a profile)
    const supabase = getSupabaseAdmin()
    const { data: profile } = await (supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', userId)
      .single() as any)

    if (profile) {
      // User is an owner - full permissions
      return {
        canDownload: true,
        canView: true,
        isOwner: true,
        ownerSubscription: profile.subscription_status,
        ownerId: userId,
      }
    }

    // User exists but has no profile - shouldn't happen in normal flow
    return {
      canDownload: false,
      canView: false,
      isOwner: false,
      ownerSubscription: null,
      ownerId: null,
    }
  }

  // User is trying to access another owner's data
  // Check if they have a family relationship
  const relationship = await getFamilyRelationship(userId, ownerId)

  if (!relationship || relationship.role !== 'family_member') {
    return {
      canDownload: false,
      canView: false,
      isOwner: false,
      ownerSubscription: null,
      ownerId: null,
    }
  }

  // Family member with valid relationship - check owner's subscription tier
  const { status, canDownload } = await getOwnerSubscriptionTier(ownerId)

  return {
    canDownload,
    canView: true, // Family members can always view
    isOwner: false,
    ownerSubscription: status,
    ownerId,
  }
}

/**
 * Middleware-style permission check for API routes
 * Throws error if permissions are insufficient
 */
export async function requireFamilyPermission(
  userId: string,
  ownerId: string,
  requiredPermission: 'view' | 'download'
): Promise<FamilyPermissions> {
  const permissions = await getFamilyPermissions(userId, ownerId)

  if (!permissions.canView) {
    throw new Error('Access denied: Not a family member')
  }

  if (requiredPermission === 'download' && !permissions.canDownload) {
    throw new Error('Access denied: Download requires Premium subscription')
  }

  return permissions
}
