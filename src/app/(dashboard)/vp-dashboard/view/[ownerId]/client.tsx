'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft } from 'lucide-react'
import { DocumentViewer } from '@/components/ui/document-viewer'
import type { DocumentMetadata } from '@/types/database'

interface FamilyDocumentViewClientProps {
  ownerId: string
}

export default function FamilyDocumentViewClient({ ownerId }: FamilyDocumentViewClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string>('')
  const [ownerTier, setOwnerTier] = useState<'free' | 'basic' | 'premium'>('free')
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/family/view?ownerId=${ownerId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setOwnerName(data.ownerName)
      setOwnerTier(data.ownerTier || 'free')
      setDocuments(data.documents || [])
      setCategories(data.categories || {})
    } catch (err: any) {
      setError(err.message)
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

  if (error) {
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
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
              {error}
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
