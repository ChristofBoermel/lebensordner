'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { importRawHexKey, unwrapKey, decryptFile } from '@/lib/security/document-e2ee'

interface AccessLinkReadiness {
  accessLinkStatus: 'ready' | 'missing_on_device' | 'missing_on_owner'
  requiresAccessLinkSetup: boolean
  userMessageKey: 'access_ready' | 'open_access_link_on_device' | 'owner_must_send_access_link'
}

interface ReceivedShare {
  id: string
  document_id: string
  owner_id: string
  trusted_person_id: string
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
  access_link_readiness?: AccessLinkReadiness
}

export function ReceivedSharesList() {
  const [shares, setShares] = useState<ReceivedShare[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingShareId, setViewingShareId] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [blobType, setBlobType] = useState<string>('')
  const [blobFileName, setBlobFileName] = useState<string>('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  const [errorShareId, setErrorShareId] = useState<string | null>(null)

  async function fetchShares() {
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
  }

  useEffect(() => {
    fetchShares()
  }, [])

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

  function hasLocalAccessLink(ownerId: string): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    return Boolean(window.localStorage.getItem(`rk_${ownerId}`))
  }

  function resolveSetupMissing(share: ReceivedShare): boolean {
    const readiness = share.access_link_readiness
    if (!readiness?.requiresAccessLinkSetup) {
      return false
    }

    if (readiness.accessLinkStatus === 'missing_on_owner') {
      return true
    }

    return !hasLocalAccessLink(share.owner_id)
  }

  const decryptShare = async (share: ReceivedShare): Promise<{ url: string; type: string; fileName: string } | null> => {
    setIsDecrypting(true)
    setDecryptError(null)
    setErrorShareId(share.id)

    try {
      // Use localStorage relationship key — no browser-direct DB query
      const rkHex = localStorage.getItem(`rk_${share.owner_id}`)
      if (!rkHex) {
        throw new Error('Zugriffslink nicht auf diesem Gerät geöffnet. Bitten Sie den Besitzer, den Link erneut zu senden.')
      }

      const rk = await importRawHexKey(rkHex, ['wrapKey', 'unwrapKey'])
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
    setErrorShareId(share.id)
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
          const readiness = share.access_link_readiness
          const setupMissing = resolveSetupMissing(share)

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

                {/* Access link setup guidance */}
                {setupMissing && readiness && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs rounded-md px-2 py-1.5 bg-amber-50 border border-amber-200 text-amber-800">
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    {readiness.accessLinkStatus === 'missing_on_owner'
                      ? 'Der Besitzer hat den Zugriffslink noch nicht erstellt. Bitte ihn, ihn zu erstellen und zu senden.'
                      : 'Zugriffslink auf diesem Gerät noch nicht geöffnet. Bitte den Besitzer, den Link erneut zu senden.'}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {decryptError && errorShareId === share.id && (
                  <p className="text-xs text-red-600 max-w-[200px]">{decryptError}</p>
                )}
                {!setupMissing && (
                  <>
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
                  </>
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
