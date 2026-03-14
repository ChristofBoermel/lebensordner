'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Link2, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import type { RelationshipEntry } from '@/types/trusted-access-frontend'

interface TrustedAccessState {
  relationships: RelationshipEntry[]
  isLoading: boolean
  error: string | null
}

export function TrustedUserStatusView() {
  const [state, setState] = useState<TrustedAccessState>({
    relationships: [],
    isLoading: true,
    error: null,
  })

  // allowed: I/O - fetch received shares and relationship state
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/documents/share-token/received')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Fehler beim Laden')
        setState({
          relationships: data.relationships ?? [],
          isLoading: false,
          error: null,
        })
      } catch (err: any) {
        setState({ relationships: [], isLoading: false, error: err.message || 'Fehler beim Laden' })
      }
    }
    void load()
  }, [])

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

  if (state.relationships.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Shield className="w-10 h-10 text-warmgray-300 mx-auto mb-3" />
          <p className="text-warmgray-600 text-sm">Keine Einladungen vorhanden.</p>
          <p className="text-warmgray-400 text-xs mt-1">
            Wenn Sie als Vertrauensperson eingeladen wurden, erscheint der Status hier nach der Annahme.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {state.relationships.map((rel) => (
        <RelationshipStatusCard key={rel.trustedPersonId} rel={rel} />
      ))}
    </div>
  )
}

function RelationshipStatusCard({ rel }: { rel: RelationshipEntry }) {
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
