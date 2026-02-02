'use client'

import { useState, useEffect, use } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle, Leaf, XCircle, Eye, ArrowLeft } from 'lucide-react'
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

export default function ViewPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const [viewData, setViewData] = useState<ViewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await fetch(`/api/download-link/${resolvedParams.token}/view`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Fehler beim Laden der Dokumente')
          return
        }

        setViewData(data)
      } catch (err: any) {
        setError(err.message || 'Verbindungsfehler')
      } finally {
        setIsLoading(false)
      }
    }
    fetchDocuments()
  }, [resolvedParams.token])

  if (isLoading) {
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

  if (error) {
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
                {error.includes('abgelaufen') ? 'Link abgelaufen' :
                 error.includes('verwendet') ? 'Link bereits verwendet' :
                 'Zugriff nicht möglich'}
              </h3>
              <p className="text-warmgray-600 mb-6">
                {error}
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

  if (!viewData || viewData.documents.length === 0) {
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
        {viewData.expiresAt && (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="py-3">
              <p className="text-sm text-amber-700 text-center">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Dieser Link ist gültig bis:{' '}
                {new Date(viewData.expiresAt).toLocaleDateString('de-DE')}{' '}
                {new Date(viewData.expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </CardContent>
          </Card>
        )}

        {/* Document Viewer */}
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
