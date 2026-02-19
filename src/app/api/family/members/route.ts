import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getTierFromSubscription, allowsFamilyDownloads, getTierDisplayInfo } from '@/lib/subscription-tiers'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface FamilyMember {
  id: string
  name: string
  email: string
  relationship: string
  direction: 'incoming' | 'outgoing' // incoming = they added me, outgoing = I added them
  linkedAt: string | null
  docsCount?: number
  tier?: {
    id: string
    name: string
    color: string
    badge: string
    canDownload: boolean
    viewOnly: boolean
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const adminClient = getSupabaseAdmin()

    // Get people who added me as their trusted person (I can see their documents)
    const { data: incomingLinks, error: inError } = await adminClient
      .from('trusted_persons')
      .select(`
        id,
        user_id,
        name,
        relationship,
        invitation_accepted_at
      `)
      .eq('linked_user_id', user.id)
      .eq('invitation_status', 'accepted')
      .eq('is_active', true)

    if (inError) {
      console.error('Error fetching incoming links:', inError)
    }

    // Get profiles and document counts for incoming links in batch
    let incomingMembers: FamilyMember[] = []
    if (incomingLinks && incomingLinks.length > 0) {
      const userIds = incomingLinks.map(link => link.user_id)

      const [{ data: profiles }, { data: docCounts }] = await Promise.all([
        adminClient
          .from('profiles')
          .select('id, full_name, email, subscription_status, stripe_price_id')
          .in('id', userIds),
        adminClient
          .rpc('get_document_counts', { p_user_ids: userIds }),
      ])

      const profileMap = new Map<string, (typeof profiles extends (infer T)[] | null ? T : never)>()
      for (const p of profiles || []) {
        profileMap.set(p.id, p)
      }

      const docCountMap = new Map<string, number>()
      for (const row of docCounts || []) {
        docCountMap.set(row.user_id, Number(row.doc_count))
      }

      incomingMembers = incomingLinks
        .map(link => {
          const profile = profileMap.get(link.user_id)
          if (!profile) return null

          const ownerTier = getTierFromSubscription(
            profile.subscription_status || null,
            profile.stripe_price_id || null
          )
          const tierDisplay = getTierDisplayInfo(ownerTier)
          const canDownload = allowsFamilyDownloads(ownerTier)
          const docsCount = docCountMap.get(link.user_id) ?? 0

          return {
            id: link.user_id,
            name: profile.full_name || profile.email.split('@')[0],
            email: profile.email,
            relationship: link.relationship,
            direction: 'incoming' as const,
            linkedAt: link.invitation_accepted_at,
            docsCount,
            tier: {
              id: ownerTier.id,
              name: tierDisplay.name,
              color: tierDisplay.color,
              badge: tierDisplay.badge,
              canDownload,
              viewOnly: tierDisplay.viewOnly,
            },
          }
        })
        .filter((m): m is FamilyMember => m !== null)
    }

    // Get people I added as trusted persons who have accepted
    const { data: outgoingLinks, error: outError } = await adminClient
      .from('trusted_persons')
      .select(`
        id,
        linked_user_id,
        name,
        email,
        relationship,
        invitation_accepted_at
      `)
      .eq('user_id', user.id)
      .eq('invitation_status', 'accepted')
      .eq('is_active', true)
      .not('linked_user_id', 'is', null)

    if (outError) {
      console.error('Error fetching outgoing links:', outError)
    }

    const outgoingMembers: FamilyMember[] = (outgoingLinks || []).map(link => ({
      id: link.linked_user_id!,
      name: link.name,
      email: link.email,
      relationship: link.relationship,
      direction: 'outgoing' as const,
      linkedAt: link.invitation_accepted_at,
    }))

    // Combine and deduplicate (someone might be both incoming and outgoing)
    const memberMap = new Map<string, FamilyMember>()

    for (const member of [...incomingMembers, ...outgoingMembers]) {
      const existing = memberMap.get(member.id)
      if (!existing) {
        memberMap.set(member.id, member)
      } else if (member.direction === 'incoming' && existing.direction === 'outgoing') {
        // If they added me as well, mark them as bidirectional (keep incoming as it gives me access)
        memberMap.set(member.id, { ...member, direction: 'incoming' })
      }
    }

    const members = Array.from(memberMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'de')
    )

    return NextResponse.json({ members })
  } catch (error: any) {
    console.error('Family members error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}
