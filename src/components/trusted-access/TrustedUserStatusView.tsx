'use client'

import { CheckCircle2, Clock, FileText, Link2, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { useTrustedUserAccess } from '@/components/trusted-access/TrustedUserAccessProvider'
import type { RelationshipEntry, TrustedAccessReceivedShareEntry } from '@/types/trusted-access-frontend'

type TrustedUserStatusCardEntry =
  | {
      key: string
      kind: 'connection'
      ownerName: string
      documentCount: number
    }
  | {
      key: string
      kind: 'relationship'
      relationship: RelationshipEntry
    }

function getOwnerNameFromShare(share: TrustedAccessReceivedShareEntry): string {
  const profile = share.profiles
  if (!profile) return 'Lebensordner'
  if (profile.full_name) return profile.full_name
  const combinedName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return combinedName || 'Lebensordner'
}

function buildStatusCards(
  relationships: RelationshipEntry[],
  shares: TrustedAccessReceivedShareEntry[]
): TrustedUserStatusCardEntry[] {
  const cards: TrustedUserStatusCardEntry[] = []
  const renderedPairKeys = new Set<string>()

  for (const relationship of relationships) {
    const pairKey = `${relationship.ownerId}:${relationship.trustedPersonId}`
    renderedPairKeys.add(pairKey)
    cards.push({
      key: pairKey,
      kind: 'relationship',
      relationship,
    })
  }

  const shareGroups = new Map<string, { ownerName: string; documentCount: number }>()
  for (const share of shares) {
    const pairKey = `${share.owner_id}:${share.trusted_person_id}`
    if (renderedPairKeys.has(pairKey)) {
      continue
    }

    const existing = shareGroups.get(pairKey)
    if (existing) {
      existing.documentCount += 1
      continue
    }

    shareGroups.set(pairKey, {
      ownerName: getOwnerNameFromShare(share),
      documentCount: 1,
    })
  }

  for (const [pairKey, shareGroup] of shareGroups.entries()) {
    cards.push({
      key: pairKey,
      kind: 'connection',
      ownerName: shareGroup.ownerName,
      documentCount: shareGroup.documentCount,
    })
  }

  return cards
}

export function TrustedUserStatusView() {
  const { state } = useTrustedUserAccess()
  const statusCards = buildStatusCards(state.relationships, state.shares)

  if (state.isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-warmgray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Laden…
      </div>
    )
  }

  if (state.error) {
    return <p className="text-sm text-red-600">{state.error}</p>
  }

  if (statusCards.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Shield className="w-10 h-10 text-warmgray-300 mx-auto mb-3" />
          <p className="text-warmgray-600 text-sm">Keine Verbindungen vorhanden.</p>
          <p className="text-warmgray-400 text-xs mt-1">
            Dieser Bereich zeigt Ihren Status nur dann an, wenn Sie als Vertrauensperson hinzugefügt wurden.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {statusCards.map((entry) => (
        <RelationshipStatusCard key={entry.key} entry={entry} />
      ))}
    </div>
  )
}

function RelationshipStatusCard({ entry }: { entry: TrustedUserStatusCardEntry }) {
  if (entry.kind === 'connection') {
    const documentsLabel = `${entry.documentCount} ${entry.documentCount === 1 ? 'Dokument verfügbar' : 'Dokumente verfügbar'}`
    return (
      <Card className="border-l-4 border-l-sage-500">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-sage-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sage-900 text-sm">Verbindung hergestellt</p>
              <p className="text-warmgray-600 text-sm mt-0.5">
                Ihr sicherer Zugriff ist aktiv. {entry.ownerName} hat bereits Dokumente mit Ihnen geteilt.
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-sage-700">
                <FileText className="w-3 h-3" />
                {documentsLabel}
              </div>
              <Button size="sm" variant="outline" className="mt-3" asChild>
                <Link href="/zugriff#familie">Geteilte Dokumente ansehen</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const rel = entry.relationship
  if (rel.status === 'waiting_for_share') {
    return (
      <Card className="border-l-4 border-l-sage-400">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-sage-600" />
            </div>
            <div>
              <p className="font-semibold text-sage-900 text-sm">Verbindung hergestellt</p>
              <p className="text-warmgray-600 text-sm mt-0.5">
                Ihr Zugriff ist eingerichtet. Dokumente erscheinen hier, sobald sie freigegeben werden.
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-warmgray-400">
                <Clock className="w-3 h-3" />
                Warten auf Freigaben des Besitzers
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // not_linked_yet — show state based on relationshipStatus
  const needsSetupLink = rel.relationshipStatus === 'setup_link_sent'
  const pendingAcceptance = rel.relationshipStatus === 'accepted_pending_setup'
  const invitedOnly = rel.relationshipStatus === 'invited'

  return (
    <Card className="border-l-4 border-l-amber-300">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Link2 className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            {invitedOnly && (
              <>
                <p className="font-semibold text-warmgray-900 text-sm">Einladung ausstehend</p>
                <p className="text-warmgray-600 text-sm mt-0.5">
                  Öffnen Sie den Einladungslink in Ihrer E-Mail, um die Einladung anzunehmen.
                </p>
              </>
            )}
            {pendingAcceptance && (
              <>
                <p className="font-semibold text-warmgray-900 text-sm">Einladung angenommen – Einrichtung ausstehend</p>
                <p className="text-warmgray-600 text-sm mt-0.5">
                  Der Besitzer sendet Ihnen noch einen sicheren Zugangslink. Bitte warten Sie.
                </p>
              </>
            )}
            {needsSetupLink && (
              <>
                <p className="font-semibold text-warmgray-900 text-sm">Sicheren Zugriff einrichten</p>
                <p className="text-warmgray-600 text-sm mt-0.5">
                  Sie haben einen sicheren Einrichtungslink erhalten. Öffnen Sie ihn, um fortzufahren.
                </p>
                <Button size="sm" className="mt-2 bg-sage-600 hover:bg-sage-700 text-white" asChild>
                  <Link href="/zugriff/access/redeem">Sicheren Zugriff einrichten</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
