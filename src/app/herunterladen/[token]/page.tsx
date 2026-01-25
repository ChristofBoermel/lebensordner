'use client'

import { useState, useEffect, use } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Loader2, AlertTriangle, CheckCircle2, Leaf, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'

interface TokenInfo {
  valid: boolean
  expired: boolean
  used: boolean
  senderName?: string
  expiresAt?: string
  error?: string
}

export default function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkToken() {
      try {
        const response = await fetch(`/api/download-link/verify/${resolvedParams.token}`)
        const data = await response.json()

        if (response.ok) {
          setTokenInfo({
            valid: true,
            expired: false,
            used: false,
            senderName: data.senderName,
            expiresAt: data.expiresAt,
          })
        } else {
          setTokenInfo({
            valid: false,
            expired: response.status === 410 && data.error?.includes('abgelaufen'),
            used: response.status === 410 && data.error?.includes('verwendet'),
            error: data.error,
          })
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

  const handleDownload = async () => {
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
                    Klicken Sie auf den Button, um alle Dokumente als ZIP-Datei herunterzuladen.
                  </p>
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full"
                  size="lg"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Wird heruntergeladen...
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
                  Nach dem Download wird dieser Link deaktiviert und kann nicht erneut verwendet werden.
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
