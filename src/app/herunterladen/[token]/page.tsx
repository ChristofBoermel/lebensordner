'use client'

import { useState, useEffect, use, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Loader2, AlertTriangle, CheckCircle2, Leaf, XCircle, Clock, Eye, Lock, FileText } from 'lucide-react'
import Link from 'next/link'

interface TokenInfo {
  valid: boolean
  expired: boolean
  used: boolean
  senderName?: string
  expiresAt?: string
  linkType?: 'view' | 'download'
  requiresClientDecryption?: boolean
  documents?: Array<{
    id: string
    category: string
    file_type: string
    is_encrypted: boolean
    wrappedDekForShare?: string
    fileIv?: string
    fileNameEncrypted?: string
    signedUrl: string
  }>
  error?: string
}

export default function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareKey, setShareKey] = useState<string>('')
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [decryptProgress, setDecryptProgress] = useState<{ current: number; total: number; currentName: string } | null>(null)
  const manualKeyInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1)
      if (hash) {
        setShareKey(hash)
      }
      window.history.replaceState(null, '', window.location.pathname)
    }

    async function checkToken() {
      try {
        const response = await fetch(`/api/download-link/${resolvedParams.token}/metadata`)
        const data = await response.json()

        if (response.ok) {
          setTokenInfo({
            valid: true,
            expired: false,
            used: false,
            senderName: data.senderName,
            expiresAt: data.expiresAt,
            linkType: data.linkType || 'download',
            requiresClientDecryption: data.requiresClientDecryption,
            documents: data.documents || [],
          })
        } else {
          const isExpired = response.status === 410 && data.error?.includes('abgelaufen')
          const isUsed = response.status === 410 && data.error?.includes('verwendet')
          setTokenInfo({
            valid: false,
            expired: isExpired,
            used: isUsed,
            error: data.error,
          })
          if (response.status === 409) {
            setError(data.error || 'Fehler beim Laden')
          }
        }
      } catch (err) {
        setTokenInfo({
          valid: false,
          expired: false,
          used: false,
          error: 'Verbindungsfehler',
        })
      } finally {
        setIsLoading(false)
      }
    }
    checkToken()
  }, [resolvedParams.token])

  const categoryNames: Record<string, string> = {
    identitaet: 'Identität',
    finanzen: 'Finanzen',
    versicherungen: 'Versicherungen',
    wohnen: 'Wohnen',
    gesundheit: 'Gesundheit',
    vertraege: 'Verträge',
    rente: 'Rente & Pension',
    familie: 'Familie',
    arbeit: 'Arbeit',
    religion: 'Religion',
    sonstige: 'Sonstige',
  }

  const getFallbackFileName = (doc: NonNullable<TokenInfo['documents']>[number], index: number) => {
    try {
      const url = new URL(doc.signedUrl)
      const pathName = url.pathname.split('/').pop()
      if (pathName) {
        return decodeURIComponent(pathName)
      }
    } catch {
      // ignore
    }
    return `Dokument_${index + 1}`
  }

  const handleAction = async () => {
    // For view mode, redirect to the view page
    if (tokenInfo?.linkType === 'view') {
      window.location.href = `/herunterladen/${resolvedParams.token}/view`
      return
    }

    if (tokenInfo?.requiresClientDecryption) {
      if (!shareKey) {
        manualKeyInputRef.current?.focus()
        return
      }

      setIsDownloading(true)
      setError(null)

      try {
        const { importRawHexKey, unwrapKey, decryptFile, decryptField } = await import('@/lib/security/document-e2ee')
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        const shareKeyAes = await importRawHexKey(shareKey, ['wrapKey', 'unwrapKey'])
        const documents = tokenInfo.documents || []

        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i]
          const displayName = getFallbackFileName(doc, i)
          setDecryptProgress({
            current: i + 1,
            total: documents.length,
            currentName: displayName,
          })

          const categoryFolder = categoryNames[doc.category] || doc.category
          const response = await fetch(doc.signedUrl)
          const arrayBuffer = await response.arrayBuffer()

          if (doc.is_encrypted) {
            const dek = await unwrapKey(doc.wrappedDekForShare!, shareKeyAes, 'AES-GCM')
            const plaintext = await decryptFile(arrayBuffer, dek, doc.fileIv!)
            const fileName = doc.fileNameEncrypted
              ? await decryptField(doc.fileNameEncrypted, dek).catch(() => displayName)
              : displayName
            zip.file(`${categoryFolder}/${fileName}`, plaintext)
          } else {
            zip.file(`${categoryFolder}/${displayName}`, arrayBuffer)
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const url = window.URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Lebensordner_Dokumente.zip'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        fetch(`/api/download-link/${resolvedParams.token}/mark-used`, { method: 'POST' }).catch(() => {})

        setDownloadComplete(true)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setDecryptProgress(null)
        setIsDownloading(false)
      }

      return
    }

    setIsDownloading(true)
    setError(null)

    try {
      const response = await fetch(`/api/download-link/${resolvedParams.token}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Download fehlgeschlagen')
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'Lebensordner_Dokumente.zip'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setDownloadComplete(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-sage-600 flex items-center justify-center">
            <Leaf className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-serif">Lebensordner</CardTitle>
          <CardDescription>Sicherer Dokumenten-Download</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-sage-600 mb-4" />
              <p className="text-warmgray-600">Link wird überprüft...</p>
            </div>
          ) : tokenInfo?.valid ? (
            downloadComplete ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                  Download abgeschlossen!
                </h3>
                <p className="text-warmgray-600 mb-6">
                  Die ZIP-Datei wurde erfolgreich heruntergeladen.
                </p>
                <p className="text-sm text-warmgray-500">
                  Dieser Link kann nicht erneut verwendet werden.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-warmgray-700 mb-2">
                    <strong>{tokenInfo.senderName}</strong> hat Dokumente mit Ihnen geteilt.
                  </p>
                  <p className="text-sm text-warmgray-500">
                    {tokenInfo.linkType === 'view'
                      ? 'Klicken Sie auf den Button, um alle Dokumente im Browser anzusehen.'
                      : 'Klicken Sie auf den Button, um alle Dokumente als ZIP-Datei herunterzuladen.'}
                  </p>
                </div>

                {tokenInfo.linkType === 'view' && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm text-center">
                    <Eye className="w-4 h-4 inline mr-1" />
                    Nur-Ansicht-Modus: Sie können die Dokumente ansehen, aber nicht herunterladen.
                  </div>
                )}

                {tokenInfo.requiresClientDecryption && !shareKey && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                    <div className="flex items-start gap-2 text-amber-800 text-sm">
                      <Lock className="w-4 h-4 mt-0.5" />
                      <span>Für diesen Link wird ein Zugriffsschlüssel benötigt. Geben Sie den Schlüssel aus der E-Mail ein.</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        ref={manualKeyInputRef}
                        value={manualKeyInput}
                        onChange={(event) => setManualKeyInput(event.target.value)}
                        placeholder="Zugriffsschlüssel eingeben"
                        className="font-mono text-sm"
                      />
                      <Button
                        onClick={() => setShareKey(manualKeyInput.trim())}
                        disabled={!manualKeyInput.trim()}
                      >
                        Zugang bestätigen
                      </Button>
                    </div>
                  </div>
                )}

                {decryptProgress && (
                  <div className="p-4 rounded-lg border border-sage-200 bg-sage-50 space-y-3">
                    <div className="flex items-center justify-between text-sm text-warmgray-700">
                      <span>Dokumente werden vorbereitet...</span>
                      <span className="font-medium">{decryptProgress.current}/{decryptProgress.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-warmgray-200 overflow-hidden">
                      <div
                        className="h-full bg-sage-600 transition-all duration-300"
                        style={{ width: `${Math.round((decryptProgress.current / decryptProgress.total) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-warmgray-600">
                      Aktuell: {decryptProgress.currentName}
                    </div>
                    <div className="space-y-2">
                      {(tokenInfo.documents || []).map((doc, index) => (
                        <div key={doc.id} className="flex items-center justify-between text-xs text-warmgray-600">
                          <div className="flex items-center gap-2">
                            {doc.is_encrypted ? (
                              <Lock className="w-3.5 h-3.5 text-sage-600" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-warmgray-500" />
                            )}
                            <span>{getFallbackFileName(doc, index)}</span>
                          </div>
                          <span>{index < decryptProgress.current ? 'bereit' : 'wartet'}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-warmgray-500">
                      Die Entschlüsselung findet lokal in Ihrem Browser statt. Es werden keine Schlüssel übertragen.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  onClick={handleAction}
                  disabled={isDownloading}
                  className="w-full"
                  size="lg"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Wird heruntergeladen...
                    </>
                  ) : tokenInfo.linkType === 'view' ? (
                    <>
                      <Eye className="w-5 h-5 mr-2" />
                      Dokumente ansehen
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Dokumente herunterladen
                    </>
                  )}
                </Button>

                {tokenInfo.expiresAt && (
                  <div className="flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                    <Clock className="w-4 h-4" />
                    <span>
                      Link gültig bis:{' '}
                      {new Date(tokenInfo.expiresAt).toLocaleDateString('de-DE')}{' '}
                      {new Date(tokenInfo.expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </span>
                  </div>
                )}

                <p className="text-xs text-warmgray-400 text-center">
                  {tokenInfo.linkType === 'view'
                    ? 'Dieser Link kann mehrfach zum Ansehen verwendet werden, solange er gültig ist.'
                    : 'Nach dem Download wird dieser Link deaktiviert und kann nicht erneut verwendet werden.'}
                </p>
              </>
            )
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                {tokenInfo?.expired
                  ? 'Link abgelaufen'
                  : tokenInfo?.used
                  ? 'Link bereits verwendet'
                  : 'Ungültiger Link'}
              </h3>
              <p className="text-warmgray-600 mb-6">
                {tokenInfo?.expired
                  ? 'Dieser Download-Link ist nicht mehr gültig. Bitte bitten Sie den Absender, einen neuen Link zu erstellen.'
                  : tokenInfo?.used
                  ? 'Dieser Link wurde bereits für einen Download verwendet. Aus Sicherheitsgründen kann jeder Link nur einmal verwendet werden.'
                  : 'Dieser Download-Link ist ungültig oder existiert nicht.'}
              </p>
              {tokenInfo?.error && !tokenInfo?.expired && !tokenInfo?.used && (
                <p className="text-sm text-red-600">
                  {tokenInfo.error}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-warmgray-200 pt-6">
            <div className="text-center">
              <p className="text-sm text-warmgray-500 mb-3">
                Möchten Sie auch Ihre wichtigen Dokumente sicher organisieren?
              </p>
              <Link href="/">
                <Button variant="outline" size="sm">
                  Mehr über Lebensordner erfahren
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
