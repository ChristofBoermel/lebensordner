'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useVault } from '@/lib/vault/VaultContext'
import { unwrapKey, decryptFile } from '@/lib/security/document-e2ee'
import { createClient } from '@/lib/supabase/client'

interface ReceivedShare {
  id: string
  document_id: string
  owner_id: string
  wrapped_dek_for_tp: string
  expires_at: string | null
  permission: string
  documents: {
    id: string
    title: string
    category: string
    file_name: string
    file_iv: string
    file_type: string
  }
  profiles: {
    full_name: string | null
    first_name: string | null
    last_name: string | null
  }
}

interface ReceivedSharesListProps {
  onRequestVaultUnlock: () => void
}

export function ReceivedSharesList({ onRequestVaultUnlock }: ReceivedSharesListProps) {
  const { isUnlocked, masterKey } = useVault()
  const [shares, setShares] = useState<ReceivedShare[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingShareId, setViewingShareId] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [blobType, setBlobType] = useState<string>('')
  const [blobFileName, setBlobFileName] = useState<string>('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchShares = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/documents/share-token/received')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fehler beim Laden')
      setShares(data.shares ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShares()
  }, [fetchShares])

  const getSharerName = (share: ReceivedShare): string => {
    const p = share.profiles
    if (p.full_name) return p.full_name
    if (p.first_name || p.last_name) {
      return [p.first_name, p.last_name].filter(Boolean).join(' ')
    }
    return 'Unbekannt'
  }

  const getHoursLeft = (expiresAt: string): number => {
    return Math.round((new Date(expiresAt).getTime() - Date.now()) / 3600000)
  }

  const decryptShare = async (share: ReceivedShare): Promise<{ url: string; type: string; fileName: string } | null> => {
    if (!isUnlocked || !masterKey) {
      onRequestVaultUnlock()
      return null
    }

    setIsDecrypting(true)
    setDecryptError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      const { data: trustedPerson, error: tpError } = await supabase
        .from('trusted_persons')
        .select('id')
        .eq('linked_user_id', user.id)
        .eq('user_id', share.owner_id)
        .single()

      if (tpError || !trustedPerson) throw new Error('Vertrauensperson nicht gefunden')

      const { data: rkData, error: rkError } = await supabase
        .from('document_relationship_keys')
        .select('wrapped_rk')
        .eq('owner_id', share.owner_id)
        .eq('trusted_person_id', trustedPerson.id)
        .single()

      if (rkError || !rkData?.wrapped_rk) throw new Error('Beziehungsschlüssel nicht gefunden')

      const rk = await unwrapKey(rkData.wrapped_rk, masterKey, 'AES-KW')
      const dek = await unwrapKey(share.wrapped_dek_for_tp, rk, 'AES-GCM')

      const res = await fetch(`/api/documents/share-token/${share.id}/file`)
      if (!res.ok) throw new Error('Fehler beim Laden der Datei')

      const encryptedBytes = await res.arrayBuffer()
      const decryptedBuffer = await decryptFile(encryptedBytes, dek, share.documents.file_iv)

      const url = URL.createObjectURL(
        new Blob([decryptedBuffer], { type: share.documents.file_type })
      )

      return { url, type: share.documents.file_type, fileName: share.documents.file_name }
    } catch (err: unknown) {
      setDecryptError(err instanceof Error ? err.message : 'Fehler beim Entschlüsseln')
      return null
    } finally {
      setIsDecrypting(false)
    }
  }

  const handleView = async (share: ReceivedShare) => {
    setViewingShareId(share.id)
    const result = await decryptShare(share)
    if (result) {
      setBlobUrl(result.url)
      setBlobType(result.type)
      setBlobFileName(result.fileName)
    } else {
      setViewingShareId(null)
    }
  }

  const handleDownload = async (share: ReceivedShare) => {
    const result = await decryptShare(share)
    if (!result) return

    const a = window.document.createElement('a')
    a.href = result.url
    a.download = result.fileName
    a.click()
    URL.revokeObjectURL(result.url)
  }

  const handleCloseViewer = () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
    }
    setBlobUrl(null)
    setBlobType('')
    setBlobFileName('')
    setViewingShareId(null)
  }

  const renderPreview = () => {
    if (!blobUrl) return null
    if (blobType === 'application/pdf' || blobType.startsWith('application/pdf')) {
      return (
        <iframe
          src={blobUrl}
          className="w-full h-[60vh] border-0"
          title="Dokument-Vorschau"
        />
      )
    }
    if (blobType.startsWith('image/')) {
      return (
        <img
          src={blobUrl}
          alt="Dokument-Vorschau"
          className="max-w-full max-h-[60vh] object-contain mx-auto"
        />
      )
    }
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <p className="text-warmgray-600">Vorschau nicht verfügbar</p>
        <a
          href={blobUrl}
          download={blobFileName}
          className="text-sage-600 hover:underline text-sm"
          onClick={() => setTimeout(handleCloseViewer, 100)}
        >
          Herunterladen
        </a>
      </div>
    )
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
    return <p className="text-warmgray-500 text-sm">Keine geteilten Dokumente vorhanden</p>
  }

  return (
    <>
      <div className="space-y-2">
        {shares.map((share) => {
          const hoursLeft = share.expires_at ? getHoursLeft(share.expires_at) : null
          const expiringSoon = hoursLeft !== null && hoursLeft <= 48 && hoursLeft > 0

          return (
            <div
              key={share.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg bg-white"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{share.documents.title}</p>
                <p className="text-xs text-warmgray-500">{getSharerName(share)}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      share.permission === 'view'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {share.permission === 'view' ? 'Nur ansehen' : 'Download'}
                  </span>
                  {expiringSoon && (
                    <div className="flex items-center gap-1 text-amber-600 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      Zugriff läuft in {hoursLeft} Stunden ab
                    </div>
                  )}
                  {!expiringSoon && share.expires_at && (
                    <span className="text-xs text-warmgray-500">
                      bis {new Date(share.expires_at).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {decryptError && viewingShareId === share.id && (
                  <p className="text-xs text-red-600">{decryptError}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleView(share)}
                  disabled={isDecrypting && viewingShareId === share.id}
                >
                  {isDecrypting && viewingShareId === share.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Ansehen'
                  )}
                </Button>
                {share.permission === 'download' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(share)}
                    disabled={isDecrypting}
                  >
                    Herunterladen
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!blobUrl} onOpenChange={(open) => { if (!open) handleCloseViewer() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{blobFileName || 'Dokument-Vorschau'}</DialogTitle>
            <DialogDescription className="sr-only">
              Vorschau des Dokuments {blobFileName}
            </DialogDescription>
          </DialogHeader>
          {renderPreview()}
        </DialogContent>
      </Dialog>
    </>
  )
}
