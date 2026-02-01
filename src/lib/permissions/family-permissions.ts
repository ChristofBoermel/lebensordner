import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface FamilyAccessResult {
  hasAccess: boolean
  accessLevel?: 'immediate' | 'emergency' | 'after_confirmation'
  ownerName?: string
  ownerEmail?: string
  relationship?: string
}

export interface AccessibleOwner {
  id: string
  name: string
  email: string
  relationship: string
  linkedAt: string | null
}

/**
 * Check if a user (viewer) has permission to access another user's (owner) documents
 * This is for family members who were invited to view documents
 */
export async function canAccessUserDocuments(
  viewerId: string,
  ownerId: string
): Promise<FamilyAccessResult> {
  const adminClient = getSupabaseAdmin()

  // Check if viewer is listed as a trusted person for the owner
  const { data: trustedPerson, error } = await adminClient
    .from('trusted_persons')
    .select(`
      id,
      name,
      access_level,
      relationship,
      user_id
    `)
    .eq('user_id', ownerId)
    .eq('linked_user_id', viewerId)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .single()

  if (error || !trustedPerson) {
    return { hasAccess: false }
  }

  // Get owner profile for name/email
  const { data: ownerProfile } = await adminClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', ownerId)
    .single()

  return {
    hasAccess: true,
    accessLevel: trustedPerson.access_level,
    ownerName: ownerProfile?.full_name || ownerProfile?.email || 'Unknown',
    ownerEmail: ownerProfile?.email,
    relationship: trustedPerson.relationship,
  }
}

/**
 * Get all users whose documents a viewer can access
 * Returns list of document owners who have accepted this user as a trusted person
 */
export async function getAccessibleOwners(viewerId: string): Promise<AccessibleOwner[]> {
  const adminClient = getSupabaseAdmin()

  // Get all trusted_person entries where this user is the linked_user_id
  // This means: people who added the viewer as their trusted person
  const { data: trustedPersonEntries, error } = await adminClient
    .from('trusted_persons')
    .select(`
      id,
      user_id,
      relationship,
      invitation_accepted_at
    `)
    .eq('linked_user_id', viewerId)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)

  if (error || !trustedPersonEntries || trustedPersonEntries.length === 0) {
    return []
  }

  // Get profiles for all owners
  const owners: AccessibleOwner[] = []
  for (const entry of trustedPersonEntries) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', entry.user_id)
      .single()

    if (profile) {
      owners.push({
        id: entry.user_id,
        name: profile.full_name || profile.email.split('@')[0],
        email: profile.email,
        relationship: entry.relationship,
        linkedAt: entry.invitation_accepted_at,
      })
    }
  }

  return owners.sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/**
 * Check if a user is primarily a document owner (has their own documents)
 * vs a family member (only viewing others' documents)
 */
export async function getUserType(userId: string): Promise<'owner' | 'family_member' | 'both'> {
  const adminClient = getSupabaseAdmin()

  // Check if user has any documents
  const { count: documentCount } = await adminClient
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Check if user has completed onboarding (indicating they intend to use as owner)
  const { data: profile } = await adminClient
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .single()

  // Check if user has access to others' documents
  const accessibleOwners = await getAccessibleOwners(userId)
  const hasAccessToOthers = accessibleOwners.length > 0

  const hasOwnDocuments = (documentCount || 0) > 0 || profile?.onboarding_completed

  if (hasOwnDocuments && hasAccessToOthers) {
    return 'both'
  } else if (hasOwnDocuments) {
    return 'owner'
  } else if (hasAccessToOthers) {
    return 'family_member'
  }

  // Default to owner (new users who haven't set up anything)
  return 'owner'
}
