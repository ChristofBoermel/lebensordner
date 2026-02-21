'use client'

import { useState, useEffect, use } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, AlertTriangle, Leaf, XCircle, Eye, ArrowLeft, Lock } from 'lucide-react'
import Link from 'next/link'
import { DocumentViewer } from '@/components/ui/document-viewer'
import type { DocumentMetadata } from '@/types/database'

interface ViewData {
  ownerName: string
  ownerTier: 'free' | 'basic' | 'premium'
  documents: DocumentMetadata[]
  categories: Record<string, string>
  expiresAt: string
}

interface MetadataDoc {
  id: string
  category: string
  file_type: string
  is_encrypted: boolean
  wrappedDekForShare?: string
  fileIv?: string
  fileNameEncrypted?: string
  signedUrl: string
}

export default function ViewPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const [viewData, setViewData] = useState<ViewData | null>(null)
  const [metadataDocuments, setMetadataDocuments] = useState<MetadataDoc[]>([])
  const [requiresClientDecryption, setRequiresClientDecryption] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [shareKey, setShareKey] = useState('')
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({})
  const [decryptingIds, setDecryptingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1)
      if (hash) {
        setShareKey(hash)
      }
      window.history.replaceState(null, '', window.location.pathname)
    }

    async function fetchMetadata() {
      try {
        setMetadataLoading(true)
        setMetadataError(null)
        const response = await fetch(`/api/download-link/${resolvedParams.token}/metadata`)
        const data = await response.json()

        if (!response.ok) {
          setMetadataError(data.error || 'Fehler beim Laden der Dokumente')
          return
        }

        setRequiresClientDecryption(!!data.requiresClientDecryption)
        setMetadataDocuments(data.documents || [])
        setExpiresAt(data.expiresAt || null)
      } catch (err: any) {
        setMetadataError(err.message || 'Verbindungsfehler')
      } finally {
        setMetadataLoading(false)
      }
    }

    fetchMetadata()
  }, [resolvedParams.token])

  useEffect(() => {
    if (metadataLoading || metadataError) return
    if (requiresClientDecryption) {
      setViewData(null)
      return
    }

    async function fetchDocuments() {
      try {
        setViewLoading(true)
        const response = await fetch(`/api/download-link/${resolvedParams.token}/view`)
        const data = await response.json()

        if (!response.ok) {
          setMetadataError(data.error || 'Fehler beim Laden der Dokumente')
          return
        }

        setViewData(data)
      } catch (err: any) {
        setMetadataError(err.message || 'Verbindungsfehler')
      } finally {
        setViewLoading(false)
      }
    }

    fetchDocuments()
  }, [metadataLoading, metadataError, requiresClientDecryption, resolvedParams.token])

  useEffect(() => {
    return () => {
      Object.values(objectUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [objectUrls])

  const handleDecryptDocument = async (doc: MetadataDoc) => {
    if (decryptingIds.has(doc.id) || objectUrls[doc.id]) {
      return
    }

    setDecryptingIds((prev) => new Set([...prev, doc.id]))
    try {
      const { importRawHexKey, unwrapKey, decryptFile } = await import('@/lib/security/document-e2ee')
      const shareKeyAes = await importRawHexKey(shareKey, ['wrapKey', 'unwrapKey'])
      const response = await fetch(doc.signedUrl)
      const arrayBuffer = await response.arrayBuffer()
      const dek = await unwrapKey(doc.wrappedDekForShare!, shareKeyAes, 'AES-GCM')
      const plaintext = await decryptFile(arrayBuffer, dek, doc.fileIv!)
      const blob = new Blob([plaintext], { type: doc.file_type || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      setObjectUrls((prev) => ({ ...prev, [doc.id]: url }))
    } catch (err) {
      setMetadataError('Entschlüsselung fehlgeschlagen. Bitte prüfen Sie den Schlüssel.')
    } finally {
      setDecryptingIds((prev) => {
        const next = new Set(prev)
        next.delete(doc.id)
        return next
      })
    }
  }

  if (metadataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12">
            <div className="flex flex-col items-center">
              <Loader2 className="w-10 h-10 animate-spin text-sage-600 mb-4" />
              <p className="text-warmgray-600">Dokumente werden geladen...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (metadataError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-sage-600 flex items-center justify-center">
              <Leaf className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-serif">Lebensordner</CardTitle>
            <CardDescription>Dokumenten-Ansicht</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-6">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                {metadataError.includes('abgelaufen') ? 'Link abgelaufen' :
                 metadataError.includes('verwendet') ? 'Link bereits verwendet' :
                 'Zugriff nicht möglich'}
              </h3>
              <p className="text-warmgray-600 mb-6">
                {metadataError}
              </p>
            </div>

            <div className="border-t border-warmgray-200 pt-6">
              <div className="text-center">
                <Link href="/">
                  <Button variant="outline" size="sm">
                    Zurück zur Startseite
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!requiresClientDecryption && viewData && viewData.documents.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-sage-600 flex items-center justify-center">
              <Leaf className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-serif">Lebensordner</CardTitle>
            <CardDescription>Dokumenten-Ansicht</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-6">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-warmgray-100 flex items-center justify-center">
                <Eye className="w-8 h-8 text-warmgray-400" />
              </div>
              <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                Keine Dokumente vorhanden
              </h3>
              <p className="text-warmgray-600 mb-6">
                Diese Person hat noch keine Dokumente hochgeladen.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back link */}
        <div className="mb-6">
          <Link href={`/herunterladen/${resolvedParams.token}`}>
            <Button variant="ghost" size="sm" className="text-warmgray-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          </Link>
        </div>

        {/* Header with branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-sage-600 flex items-center justify-center">
              <Leaf className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-serif font-semibold text-warmgray-900">Lebensordner</span>
          </div>
        </div>

        {/* Expiry notice */}
        {expiresAt && (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="py-3">
              <p className="text-sm text-amber-700 text-center">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Dieser Link ist gültig bis:{' '}
                {new Date(expiresAt).toLocaleDateString('de-DE')}{' '}
                {new Date(expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </CardContent>
          </Card>
        )}

        {requiresClientDecryption && !shareKey && (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-start gap-3 text-amber-800">
                <Lock className="w-5 h-5 mt-0.5" />
                <div>
                  <p className="font-medium">Zugriffsschlüssel erforderlich</p>
                  <p className="text-sm text-amber-700">
                    Geben Sie den Schlüssel aus der E-Mail ein, um die Dokumente zu entschlüsseln.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
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
            </CardContent>
          </Card>
        )}

        {requiresClientDecryption && shareKey && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metadataDocuments.map((doc) => {
              const objectUrl = objectUrls[doc.id]
              const isPdf = doc.file_type?.includes('pdf')
              const isImage = doc.file_type?.startsWith('image/')
              const isDecrypting = decryptingIds.has(doc.id)

              return (
                <Card key={doc.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {doc.is_encrypted && <Lock className="w-4 h-4 text-sage-600" />}
                      Dokument
                    </CardTitle>
                    <CardDescription>
                      {doc.is_encrypted ? 'Verschlüsselt' : 'Unverschlüsselt'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {doc.is_encrypted ? (
                      objectUrl ? (
                        isPdf ? (
                          <iframe
                            src={objectUrl}
                            className="w-full h-80 rounded-md border"
                            title="Dokument Vorschau"
                          />
                        ) : isImage ? (
                          <img
                            src={objectUrl}
                            alt="Dokument Vorschau"
                            className="w-full h-80 object-contain rounded-md border"
                          />
                        ) : (
                          <a
                            href={objectUrl}
                            className="text-sage-700 underline text-sm"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Datei öffnen
                          </a>
                        )
                      ) : (
                        <Button
                          onClick={() => handleDecryptDocument(doc)}
                          disabled={isDecrypting}
                          className="w-full"
                        >
                          {isDecrypting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Entschlüsselt...
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 mr-2" />
                              Entschlüsseln
                            </>
                          )}
                        </Button>
                      )
                    ) : (
                      isPdf ? (
                        <iframe
                          src={doc.signedUrl}
                          className="w-full h-80 rounded-md border"
                          title="Dokument Vorschau"
                        />
                      ) : isImage ? (
                        <img
                          src={doc.signedUrl}
                          alt="Dokument Vorschau"
                          className="w-full h-80 object-contain rounded-md border"
                        />
                      ) : (
                        <a
                          href={doc.signedUrl}
                          className="text-sage-700 underline text-sm"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Datei öffnen
                        </a>
                      )
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {!requiresClientDecryption && viewLoading && (
          <Card className="border-sage-200 bg-sage-50">
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-sage-600 mr-2" />
                <span className="text-warmgray-600">Dokumente werden geladen...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {!requiresClientDecryption && viewData && (
          <DocumentViewer
            documents={viewData.documents}
            ownerName={viewData.ownerName}
            ownerTier={viewData.ownerTier}
            categories={viewData.categories}
            viewMode="page"
            showHeader={true}
            showInfoBanner={true}
            streamUrlBase={`/api/download-link/${resolvedParams.token}/view/stream`}
          />
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
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
    </div>
  )
}
