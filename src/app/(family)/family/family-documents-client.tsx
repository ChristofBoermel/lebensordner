'use client'

import React, { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/loading/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  FileText,
  Eye,
  Download,
  Lock,
  AlertCircle,
  Folder,
  User,
  Archive,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'
import { formatDate, formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FamilyDocumentsClientProps {
  documents: Array<{
    id: string
    title: string
    file_name: string
    file_size: number
    file_type: string
    category: DocumentCategory
    created_at: string
    notes: string | null
  }>
  ownerId: string
  ownerName: string
  canDownload: boolean
}

// Helper to get icon component
function getIcon(iconName: string) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    user: User,
    folder: Folder,
    'file-text': FileText,
  }
  return icons[iconName] || FileText
}

// Individual document card with selection and download
interface FamilyDocumentCardProps {
  document: FamilyDocumentsClientProps['documents'][0]
  ownerId: string
  canDownload: boolean
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  selectionMode: boolean
}

function FamilyDocumentCard({
  document,
  ownerId,
  canDownload,
  isSelected,
  onSelect,
  selectionMode,
}: FamilyDocumentCardProps) {
  const [isViewing, startViewing] = useTransition()
  const [isDownloading, startDownloading] = useTransition()
  const category = DOCUMENT_CATEGORIES[document.category]
  const Icon = category?.icon ? getIcon(category.icon) : FileText

  const handleView = () => {
    startViewing(async () => {
      const response = await fetch('/api/family/documents/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, ownerId }),
      })

      if (response.ok) {
        const { signedUrl } = await response.json()
        window.open(signedUrl, '_blank')
      }
    })
  }

  const handleDownload = () => {
    if (!canDownload) return

    startDownloading(async () => {
      const response = await fetch('/api/family/documents/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, ownerId }),
      })

      if (response.ok) {
        const { signedUrl, fileName } = await response.json()
        const link = document.createElement('a')
        link.href = signedUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    })
  }

  return (
    <Card
      className={cn(
        'overflow-hidden border-warmgray-200 bg-white transition-shadow',
        selectionMode && 'relative',
        isSelected && 'ring-2 ring-sage-500'
      )}
    >
      {/* Selection Checkbox Overlay */}
      {selectionMode && (
        <div className="absolute left-3 top-3 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(document.id, checked as boolean)}
            className="h-8 w-8 min-h-[44px] min-w-[44px] border-2 data-[state=checked]:bg-sage-600 data-[state=checked]:border-sage-600"
            aria-label={`${document.title} auswählen`}
          />
        </div>
      )}

      <CardHeader className={cn('space-y-3 p-4 sm:p-5', selectionMode && 'pl-12')}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sage-100">
            <Icon className="h-5 w-5 text-sage-700" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-2 text-base font-medium leading-[1.4] text-warmgray-900">
              {document.title}
            </CardTitle>
            <p className="mt-1 text-sm leading-[1.6] text-warmgray-500">
              {category?.name || document.category}
            </p>
          </div>
        </div>

        {document.notes && (
          <p className="text-sm leading-[1.6] text-warmgray-600 line-clamp-2">
            {document.notes}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-[1.6] text-warmgray-500">
          <span>{formatFileSize(document.file_size)}</span>
          <span>•</span>
          <span>{formatDate(document.created_at)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {/* View Button - Always available */}
        <Button
          onClick={handleView}
          disabled={isViewing}
          variant="default"
          size="lg"
          className="h-12 w-full text-sm font-medium"
        >
          {isViewing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Wird geöffnet...
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              Dokument ansehen
            </>
          )}
        </Button>

        {/* Download Button - Premium only */}
        {canDownload ? (
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            variant="outline"
            size="lg"
            className="h-12 w-full text-sm font-medium"
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Wird heruntergeladen...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Herunterladen
              </>
            )}
          </Button>
        ) : (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  disabled
                  className="h-12 w-full cursor-not-allowed border-dashed border-warmgray-300 bg-warmgray-50 text-warmgray-500"
                  aria-describedby={`download-tooltip-${document.id}`}
                >
                  <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
                  Download nicht verfügbar
                </Button>
              </TooltipTrigger>
              <TooltipContent
                id={`download-tooltip-${document.id}`}
                side="bottom"
                className="max-w-xs text-center"
              >
                <p>Download mit Premium verfügbar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  )
}

// Main client component
export function FamilyDocumentsClient({
  documents,
  ownerId,
  ownerName,
  canDownload,
}: FamilyDocumentsClientProps) {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [isZipping, startZipping] = useTransition()

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set())
    } else {
      setSelectedDocs(new Set(documents.map((d) => d.id)))
    }
  }

  const handleZipDownload = () => {
    if (!canDownload || selectedDocs.size === 0) return

    startZipping(async () => {
      const response = await fetch(
        `/api/family/download?ownerId=${ownerId}&documentIds=${Array.from(selectedDocs).join(',')}`,
        { method: 'GET' }
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `Dokumente_${ownerName}_${new Date().toISOString().split('T')[0]}.zip`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        setSelectedDocs(new Set())
        setSelectionMode(false)
      }
    })
  }

  // Group documents by category
  const documentsByCategory = documents.reduce((acc, doc) => {
    const category = doc.category
    if (!acc[category]) acc[category] = []
    acc[category].push(doc)
    return acc
  }, {} as Record<string, typeof documents>)

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warmgray-200 bg-white p-4">
        {/* Selection Mode Toggle */}
        <Button
          onClick={() => {
            setSelectionMode(!selectionMode)
            if (selectionMode) setSelectedDocs(new Set())
          }}
          variant={selectionMode ? 'default' : 'outline'}
          size="lg"
          className="h-12 min-w-[44px] text-sm font-medium"
        >
          {selectionMode ? (
            <>
              <CheckSquare className="mr-2 h-4 w-4" aria-hidden="true" />
              Auswahlmodus beenden
            </>
          ) : (
            <>
              <Square className="mr-2 h-4 w-4" aria-hidden="true" />
              Mehrere auswählen
            </>
          )}
        </Button>

        {/* Select All - Only in selection mode */}
        {selectionMode && (
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="lg"
            className="h-12 min-w-[44px] text-sm font-medium"
          >
            {selectedDocs.size === documents.length ? (
              <>Alle abwählen</>
            ) : (
              <>Alle auswählen</>
            )}
          </Button>
        )}

        {/* ZIP Download - Only in selection mode with Premium */}
        {selectionMode && canDownload && selectedDocs.size > 0 && (
          <Button
            onClick={handleZipDownload}
            disabled={isZipping}
            variant="default"
            size="lg"
            className="h-12 min-w-[44px] bg-sage-600 text-sm font-medium hover:bg-sage-700"
          >
            {isZipping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ZIP wird erstellt...
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                ZIP herunterladen ({selectedDocs.size})
              </>
            )}
          </Button>
        )}

        {/* Selection count */}
        {selectionMode && selectedDocs.size > 0 && !canDownload && (
          <span className="text-sm text-warmgray-600">
            {selectedDocs.size} ausgewählt
          </span>
        )}
      </div>

      {/* Basic Owner Notice */}
      {!canDownload && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 sm:p-6">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h3 className="font-medium text-amber-900">Eingeschränkter Zugriff</h3>
              <p className="mt-1 text-sm leading-[1.6] text-amber-700">
                Sie können Dokumente ansehen, aber nicht herunterladen. Der Download erfordert ein Premium-Abonnement von {ownerName}.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents by category */}
      <div className="space-y-8">
        {Object.entries(documentsByCategory).map(([categoryKey, categoryDocs]) => {
          const category = DOCUMENT_CATEGORIES[categoryKey as DocumentCategory]

          return (
            <section key={categoryKey} aria-labelledby={`category-${categoryKey}`}>
              <h2
                id={`category-${categoryKey}`}
                className="mb-4 text-lg font-medium text-warmgray-900 sm:mb-6"
              >
                {category?.name || categoryKey}
                <span className="ml-2 text-sm font-normal text-warmgray-500">
                  ({categoryDocs.length})
                </span>
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryDocs.map((document) => (
                  <FamilyDocumentCard
                    key={document.id}
                    document={document}
                    ownerId={ownerId}
                    canDownload={canDownload}
                    isSelected={selectedDocs.has(document.id)}
                    onSelect={handleSelect}
                    selectionMode={selectionMode}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

// Loading skeleton for documents
export function DocumentsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-14 rounded-lg border border-warmgray-200 bg-white p-4">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="space-y-2 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
