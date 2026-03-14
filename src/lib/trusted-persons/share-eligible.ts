import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface ShareEligibleTrustedPerson {
  id: string
  name: string
  email: string
  linked_user_id: string
}

type TrustedPersonRecipientRow = Pick<
  Database['public']['Tables']['trusted_persons']['Row'],
  'id' | 'name' | 'email' | 'linked_user_id' | 'relationship_status'
>

export async function loadShareEligibleTrustedPersons(
  supabase: SupabaseClient<Database>
): Promise<ShareEligibleTrustedPerson[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  try {
    await fetch('/api/trusted-person/link', { method: 'POST' })
  } catch {
    // Best effort: recipient loading should still proceed if link repair fails.
  }

  const { data, error } = await supabase
    .from('trusted_persons')
    .select('id, name, email, linked_user_id, relationship_status')
    .eq('user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .eq('relationship_status', 'active')
    .not('linked_user_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as TrustedPersonRecipientRow[])
    .filter(
      (
        trustedPerson
      ): trustedPerson is TrustedPersonRecipientRow & { linked_user_id: string } =>
        typeof trustedPerson.linked_user_id === 'string' && trustedPerson.linked_user_id.length > 0
    )
    .map((trustedPerson) => ({
      id: trustedPerson.id,
      name: trustedPerson.name,
      email: trustedPerson.email,
      linked_user_id: trustedPerson.linked_user_id,
    }))
}
