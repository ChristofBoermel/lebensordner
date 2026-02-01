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
  X,
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

// Individual document card - Read-only view with selection support
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

  const iconName = category?.icon || 'file-text'
  const Icon = iconName === 'user' ? User : iconName === 'folder' ? Folder : FileText

  const handleView = () => {
    startViewing(async () => {
      try {
        const response = await fetch('/api/family/documents/download-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: document.id, ownerId }),
        })

        if (response.ok) {
          const { signedUrl } = await response.json()
          window.open(signedUrl, '_blank')
        }
      } catch (err) {
        console.error('View failed:', err)
      }
    })
  }

  const handleDownload = () => {
    if (!canDownload) return

    startDownloading(async () => {
      try {
        const response = await fetch('/api/family/documents/download-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: document.id, ownerId }),
        })

        if (response.ok) {
          const { signedUrl, fileName } = await response.json()
          const link = window.document.createElement('a')
          link.href = signedUrl
          link.download = fileName
          window.document.body.appendChild(link)
          link.click()
          window.document.body.removeChild(link)
        }
      } catch (err) {
        console.error('Download failed:', err)
      }
    })
  }

  return (
    <Card
      className={cn(
        "flex flex-col h-full border-warmgray-200 bg-white shadow-sm ring-offset-background transition-all focus-within:ring-2 focus-within:ring-sage-500 focus-within:ring-offset-2 hover:border-sage-300",
        isSelected && "ring-2 ring-sage-600 border-sage-600 bg-sage-50/30"
      )}
    >
      <CardHeader className={cn("space-y-4 p-6 sm:p-8", selectionMode && "pl-14 relative")}>
        {selectionMode && (
          <div className="absolute left-4 top-8 sm:left-6">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(document.id, checked as boolean)}
              className="h-8 w-8 min-h-[44px] min-w-[44px] border-2 data-[state=checked]:bg-sage-600 data-[state=checked]:border-sage-600"
              aria-label={`${document.title} auswählen`}
            />
          </div>
        )}

        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sage-100">
            <Icon className="h-7 w-7 text-sage-700" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="scroll-m-20 text-xl font-semibold tracking-tight leading-[1.4] text-warmgray-900 break-words">
              {document.title}
            </CardTitle>
            <p className="text-lg leading-[1.6] text-warmgray-600 font-medium">
              {category?.name || document.category}
            </p>
          </div>
        </div>

        {document.notes && (
          <div className="rounded-lg bg-warmgray-50 p-4 border border-warmgray-100">
            <p className="text-base leading-[1.6] text-warmgray-700 italic">
              "{document.notes}"
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm leading-[1.6] text-warmgray-500">
          <span className="flex items-center gap-1.5">
            <Archive className="h-4 w-4" />
            {formatFileSize(document.file_size)}
          </span>
          <span className="hidden xs:inline text-warmgray-300">•</span>
          <span>{formatDate(document.created_at)}</span>
        </div>
      </CardHeader>

      <div className="flex-grow" />

      <CardContent className="space-y-4 p-6 pt-0 sm:p-8 sm:pt-0">
        <Button
          onClick={handleView}
          disabled={isViewing || selectionMode}
          variant="default"
          className="h-[56px] w-full text-lg font-semibold shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
          aria-label={`${document.title} ansehen`}
        >
          {isViewing ? (
            <div className="flex items-center justify-center">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
              <span>Wird geöffnet...</span>
            </div>
          ) : (
            <>
              <Eye className="mr-3 h-5 w-5" aria-hidden="true" />
              Dokument ansehen
            </>
          )}
        </Button>

        {canDownload ? (
          <Button
            onClick={handleDownload}
            disabled={isDownloading || selectionMode}
            variant="outline"
            className="h-[56px] w-full text-lg font-semibold border-2 hover:bg-sage-50 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
            aria-label={`${document.title} herunterladen`}
          >
            {isDownloading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
                <span>Wird gespeichert...</span>
              </div>
            ) : (
              <>
                <Download className="mr-3 h-5 w-5" aria-hidden="true" />
                Herunterladen
              </>
            )}
          </Button>
        ) : (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center justify-center gap-3 h-[56px] w-full rounded-md border-2 border-dashed border-warmgray-200 bg-warmgray-50 px-4 text-center text-warmgray-500 cursor-not-allowed"
                  role="note"
                >
                  <Lock className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="text-base font-medium leading-[1.6]">Download nicht verfügbar</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-center border-sage-200 bg-white p-4 shadow-lg">
                <p className="text-sage-900 font-medium">Download mit Premium verfügbar</p>
                <p className="text-xs text-warmgray-500 mt-1">Bitten Sie {ownerId === 'me' ? 'den Besitzer' : 'Ihr Familienmitglied'}, auf Premium umzusteigen.</p>
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocs(new Set(documents.map((d) => d.id)))
    } else {
      setSelectedDocs(new Set())
    }
  }

  const handleZipDownload = () => {
    if (!canDownload || selectedDocs.size === 0) return

    startZipping(async () => {
      try {
        const response = await fetch(
          `/api/family/download?ownerId=${ownerId}&documentIds=${Array.from(selectedDocs).join(',')}`,
          { method: 'GET' }
        )

        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const link = window.document.createElement('a')
          link.href = url
          link.download = `Dokumente_${ownerName}_${new Date().toISOString().split('T')[0]}.zip`
          window.document.body.appendChild(link)
          link.click()
          window.document.body.removeChild(link)
          window.URL.revokeObjectURL(url)

          // Reset selection after download
          setSelectedDocs(new Set())
          setSelectionMode(false)
        }
      } catch (err) {
        console.error('ZIP download failed:', err)
      }
    })
  }

  const documentsByCategory = documents.reduce((acc, doc) => {
    const category = doc.category
    if (!acc[category]) acc[category] = []
    acc[category].push(doc)
    return acc
  }, {} as Record<string, typeof documents>)

  return (
    <div className="space-y-12">
      {/* Toolbar - Only visible for Premium or enabled when selection mode is active */}
      <div className="sticky top-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warmgray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:p-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => {
              setSelectionMode(!selectionMode)
              if (selectionMode) setSelectedDocs(new Set())
            }}
            variant={selectionMode ? "default" : "outline"}
            className="h-[56px] px-6 text-lg font-semibold"
          >
            {selectionMode ? (
              <>
                <X className="mr-3 h-5 w-5" />
                Auswahl beenden
              </>
            ) : (
              <>
                <CheckSquare className="mr-3 h-5 w-5" />
                Mehrere auswählen
              </>
            )}
          </Button>

          {selectionMode && (
            <div className="flex items-center gap-3">
              <Checkbox
                id="select-all"
                checked={selectedDocs.size === documents.length}
                onCheckedChange={handleSelectAll}
                className="h-6 w-6 border-2"
              />
              <label htmlFor="select-all" className="text-lg font-medium text-warmgray-700 cursor-pointer">
                Alle ({documents.length})
              </label>
            </div>
          )}
        </div>

        {selectionMode && (
          <div className="flex items-center gap-4">
            {canDownload ? (
              <Button
                onClick={handleZipDownload}
                disabled={isZipping || selectedDocs.size === 0}
                className="h-[56px] px-8 text-lg font-bold bg-sage-600 hover:bg-sage-700 shadow-sage-200 shadow-md transition-all active:scale-95 disabled:bg-warmgray-200"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    ZIP wird erstellt...
                  </>
                ) : (
                  <>
                    <Archive className="mr-3 h-5 w-5" />
                    PDFs laden ({selectedDocs.size})
                  </>
                )}
              </Button>
            ) : (
              <p className="text-sm font-medium text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 italic">
                Sammel-Download erfordert Premium
              </p>
            )}
          </div>
        )}
      </div>

      {/* Notice for basic users */}
      {!canDownload && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm overflow-hidden">
          <CardContent className="flex items-start gap-4 p-6 sm:p-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Lock className="h-6 w-6 text-amber-700" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-900 leading-[1.3]">Eingeschränkter Zugriff</h2>
              <p className="mt-2 text-lg leading-[1.6] text-amber-800">
                Sie können die Dokumente direkt im Browser ansehen.
                Das Herunterladen (Speichern auf Ihrem Gerät) ist derzeit nicht aktiviert.
                Dazu benötigt {ownerName} ein Premium-Abonnement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid view by category */}
      <div className="space-y-16">
        {Object.entries(documentsByCategory).map(([categoryKey, categoryDocs]) => {
          const category = DOCUMENT_CATEGORIES[categoryKey as DocumentCategory]

          return (
            <section key={categoryKey} aria-labelledby={`category-${categoryKey}`} className="space-y-6">
              <div className="flex items-center gap-4 border-b border-warmgray-200 pb-4">
                <h2
                  id={`category-${categoryKey}`}
                  className="text-2xl font-bold tracking-tight text-warmgray-900 sm:text-3xl"
                >
                  {category?.name || categoryKey}
                </h2>
                <span className="rounded-full bg-warmgray-100 px-3 py-1 text-sm font-semibold text-warmgray-600">
                  {categoryDocs.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="space-y-12">
      <div className="h-[88px] w-full rounded-2xl bg-warmgray-200 animate-pulse" />
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden border-warmgray-200">
            <CardHeader className="space-y-4 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
            </CardHeader>
            <CardContent className="space-y-4 p-6 pt-0 sm:p-8 sm:pt-0">
              <Skeleton className="h-[56px] w-full" />
              <Skeleton className="h-[56px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
