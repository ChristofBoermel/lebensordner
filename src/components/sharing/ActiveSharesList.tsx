'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface ShareRow {
  id: string
  document_id: string
  trusted_person_id: string
  permission: string
  expires_at: string | null
  revoked_at: string | null
}

interface ActiveSharesListProps {
  ownerId: string
}

export function ActiveSharesList({ ownerId }: ActiveSharesListProps) {
  const [shares, setShares] = useState<ShareRow[]>([])
  const [documentTitles, setDocumentTitles] = useState<Record<string, string>>({})
  const [recipientNames, setRecipientNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchShares = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: sharesError } = await supabase
        .from('document_share_tokens')
        .select('id, document_id, trusted_person_id, permission, expires_at, revoked_at')
        .eq('owner_id', ownerId)

      if (sharesError) throw sharesError

      const activeShares = (data ?? []).filter(s => s.revoked_at === null)
      setShares(activeShares)

      if (activeShares.length === 0) {
        setIsLoading(false)
        return
      }

      const documentIds = [...new Set(activeShares.map(s => s.document_id))]
      const trustedPersonIds = [...new Set(activeShares.map(s => s.trusted_person_id))]

      const [{ data: docs }, { data: persons }] = await Promise.all([
        supabase.from('documents').select('id, title').in('id', documentIds),
        supabase.from('trusted_persons').select('id, name').in('id', trustedPersonIds),
      ])

      const titlesMap: Record<string, string> = {}
      for (const doc of docs ?? []) {
        titlesMap[doc.id] = doc.title
      }
      setDocumentTitles(titlesMap)

      const namesMap: Record<string, string> = {}
      for (const person of persons ?? []) {
        namesMap[person.id] = person.name
      }
      setRecipientNames(namesMap)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, ownerId])

  useEffect(() => {
    fetchShares()
  }, [fetchShares])

  const handleRevoke = async (shareId: string) => {
    setRevokingId(shareId)
    try {
      const res = await fetch(`/api/documents/share-token?id=${shareId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Fehler beim Widerrufen')
      }
      setConfirmRevokeId(null)
      await fetchShares()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Widerrufen')
    } finally {
      setRevokingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-sage-600" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  if (shares.length === 0) {
    return <p className="text-warmgray-500 text-sm">Keine aktiven Freigaben</p>
  }

  return (
    <div className="space-y-2">
      {shares.map((share) => (
        <div
          key={share.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg bg-white"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {documentTitles[share.document_id] ?? share.document_id.slice(0, 8) + '...'}
            </p>
            <p className="text-xs text-warmgray-500">
              {recipientNames[share.trusted_person_id] ?? '—'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  share.permission === 'view'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {share.permission === 'view' ? 'Nur ansehen' : 'Download'}
              </span>
              <span className="text-xs text-warmgray-500">
                {share.expires_at
                  ? new Date(share.expires_at).toLocaleDateString('de-DE')
                  : 'Kein Ablaufdatum'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {confirmRevokeId === share.id ? (
              <>
                <span className="text-xs text-warmgray-700">Wirklich widerrufen?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRevoke(share.id)}
                  disabled={revokingId === share.id}
                >
                  {revokingId === share.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Ja'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmRevokeId(null)}
                >
                  Nein
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmRevokeId(share.id)}
              >
                Widerrufen
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
