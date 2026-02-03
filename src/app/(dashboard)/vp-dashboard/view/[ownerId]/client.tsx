'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, RefreshCw, AlertTriangle, UserX, CreditCard, ShieldOff } from 'lucide-react'
import { DocumentViewer } from '@/components/ui/document-viewer'
import type { DocumentMetadata } from '@/types/database'

interface FamilyDocumentViewClientProps {
  ownerId: string
}

interface ErrorResponse {
  error: string
  errorCode?: string
  details?: string
  requiredTier?: string
}

export default function FamilyDocumentViewClient({ ownerId }: FamilyDocumentViewClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [errorData, setErrorData] = useState<ErrorResponse | null>(null)
  const [isNetworkError, setIsNetworkError] = useState(false)
  const [ownerName, setOwnerName] = useState<string>('')
  const [ownerTier, setOwnerTier] = useState<'free' | 'basic' | 'premium'>('free')
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setErrorData(null)
    setIsNetworkError(false)

    try {
      const response = await fetch(`/api/family/view?ownerId=${ownerId}`)
      const data = await response.json()

      if (!response.ok) {
        setErrorData({
          error: data.error || 'Fehler beim Laden',
          errorCode: data.errorCode,
          details: data.details,
          requiredTier: data.requiredTier
        })
        return
      }

      setOwnerName(data.ownerName)
      setOwnerTier(data.ownerTier || 'free')
      setDocuments(data.documents || [])
      setCategories(data.categories || {})
    } catch (err: any) {
      // Network or parsing error
      setIsNetworkError(true)
      setErrorData({
        error: 'Netzwerkfehler',
        errorCode: 'NETWORK_ERROR',
        details: 'Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.'
      })
    } finally {
      setIsLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  if (errorData) {
    // Determine error icon and styling based on error code
    const getErrorIcon = () => {
      switch (errorData.errorCode) {
        case 'NO_RELATIONSHIP':
          return <UserX className="w-8 h-8 text-orange-500" />
        case 'INVITATION_PENDING':
          return <AlertTriangle className="w-8 h-8 text-yellow-500" />
        case 'RELATIONSHIP_INACTIVE':
          return <ShieldOff className="w-8 h-8 text-red-500" />
        case 'FREE_TIER':
          return <CreditCard className="w-8 h-8 text-blue-500" />
        case 'NETWORK_ERROR':
          return <RefreshCw className="w-8 h-8 text-gray-500" />
        default:
          return <AlertTriangle className="w-8 h-8 text-red-500" />
      }
    }

    const getErrorBgColor = () => {
      switch (errorData.errorCode) {
        case 'NO_RELATIONSHIP':
          return 'bg-orange-50 border-orange-200'
        case 'INVITATION_PENDING':
          return 'bg-yellow-50 border-yellow-200'
        case 'RELATIONSHIP_INACTIVE':
          return 'bg-red-50 border-red-200'
        case 'FREE_TIER':
          return 'bg-blue-50 border-blue-200'
        case 'NETWORK_ERROR':
          return 'bg-gray-50 border-gray-200'
        default:
          return 'bg-red-50 border-red-200'
      }
    }

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-0">
        <Button
          variant="ghost"
          onClick={() => router.push('/vp-dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className={`p-6 rounded-lg border ${getErrorBgColor()}`}>
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {getErrorIcon()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    {errorData.error}
                  </h3>
                  {errorData.details && (
                    <p className="text-gray-600 mb-4">
                      {errorData.details}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {isNetworkError && (
                      <Button
                        onClick={fetchDocuments}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Erneut versuchen
                      </Button>
                    )}
                    {errorData.errorCode === 'FREE_TIER' && (
                      <p className="text-sm text-gray-500 mt-2">
                        Hinweis: Der Besitzer muss ein kostenpflichtiges Abonnement (Basis oder Premium) haben, damit Sie die Dokumente einsehen können.
                      </p>
                    )}
                    {errorData.errorCode === 'NO_RELATIONSHIP' && (
                      <p className="text-sm text-gray-500 mt-2">
                        Hinweis: Der Besitzer muss Sie zuerst als Vertrauensperson hinzufügen.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      {/* Back Button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/vp-dashboard')}
          className="shrink-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>
      </div>

      {/* Document Viewer Component */}
      <DocumentViewer
        documents={documents}
        ownerName={ownerName}
        ownerTier={ownerTier}
        categories={categories}
        viewMode="page"
        showHeader={true}
        showInfoBanner={true}
      />
    </div>
  )
}
