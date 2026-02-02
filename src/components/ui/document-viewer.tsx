'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Image as ImageIcon,
  File,
  FolderOpen,
  Calendar,
  StickyNote,
  AlertTriangle,
  Eye,
  Crown,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DocumentMetadata } from '@/types/database'

export interface DocumentViewerProps {
  documents: DocumentMetadata[]
  ownerName: string
  ownerTier: 'free' | 'basic' | 'premium' | string
  categories: Record<string, string>
  viewMode?: 'page' | 'modal'
  showHeader?: boolean
  showInfoBanner?: boolean
  streamUrlBase?: string // Custom stream URL base, defaults to /api/family/view/stream
}

export function DocumentViewer({
  documents,
  ownerName,
  ownerTier,
  categories,
  viewMode = 'page',
  showHeader = true,
  showInfoBanner = true,
  streamUrlBase = '/api/family/view/stream',
}: DocumentViewerProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)

  // Reset zoom and rotation when document changes
  useEffect(() => {
    setZoom(100)
    setRotation(0)
  }, [selectedDoc?.id])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  // Build the stream URL for secure inline viewing
  const getStreamUrl = (doc: DocumentMetadata) => {
    if (!doc.streamToken) return null
    return `${streamUrlBase}?docId=${encodeURIComponent(doc.id)}&token=${encodeURIComponent(doc.streamToken)}`
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-sage-600" />
    if (fileType === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />
    return <File className="w-5 h-5 text-warmgray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  // Group documents by category
  const documentsByCategory = documents.reduce((acc, doc) => {
    const cat = doc.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {} as Record<string, DocumentMetadata[]>)

  const isImage = selectedDoc?.file_type?.startsWith('image/')
  const isPDF = selectedDoc?.file_type === 'application/pdf'
  const canPreview = isImage || isPDF
  const streamUrl = selectedDoc ? getStreamUrl(selectedDoc) : null

  const renderPreview = () => {
    if (!streamUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-warmgray-500">
          <File className="w-16 h-16 mb-4" aria-hidden="true" />
          <p>Vorschau nicht verfügbar</p>
        </div>
      )
    }

    if (isImage) {
      return (
        <div
          className="relative overflow-auto max-h-[calc(100vh-12rem)] flex items-center justify-center bg-warmgray-100 rounded-lg"
          role="img"
          aria-label={`Bildvorschau: ${selectedDoc?.title}`}
        >
          <img
            src={streamUrl}
            alt={selectedDoc?.title || 'Dokument'}
            className="max-w-full max-h-[calc(100vh-14rem)] object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            }}
          />
        </div>
      )
    }

    if (isPDF) {
      return (
        <div className="relative overflow-hidden rounded-lg bg-warmgray-100">
          <iframe
            src={`${streamUrl}#toolbar=0`}
            className="w-full max-h-[calc(100vh-12rem)] border-0"
            style={{ height: 'calc(100vh - 12rem)' }}
            title={`PDF-Vorschau: ${selectedDoc?.title}`}
          />
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center h-96 text-warmgray-500">
        <FileText className="w-16 h-16 mb-4" aria-hidden="true" />
        <p className="mb-2">Vorschau für diesen Dateityp nicht verfügbar</p>
        <p className="text-sm">{selectedDoc?.file_type}</p>
      </div>
    )
  }

  const renderTierBadge = () => {
    if (ownerTier === 'basic') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 flex items-center gap-1">
          Basis
        </span>
      )
    }
    if (ownerTier === 'premium') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 flex items-center gap-1">
          <Crown className="w-3 h-3" aria-hidden="true" />
          Premium
        </span>
      )
    }
    return null
  }

  const containerClass = viewMode === 'modal'
    ? 'space-y-4'
    : 'max-w-6xl mx-auto space-y-6 px-4 sm:px-0'

  return (
    <div className={containerClass}>
      {/* Header */}
      {showHeader && viewMode === 'page' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-semibold text-warmgray-900">
                Dokumente von {ownerName}
              </h1>
              {renderTierBadge()}
            </div>
            <p className="text-warmgray-600 mt-1">
              <Eye className="w-4 h-4 inline mr-1" aria-hidden="true" />
              Nur-Ansicht-Modus
            </p>
          </div>
        </div>
      )}

      {/* Modal Header */}
      {showHeader && viewMode === 'modal' && (
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-warmgray-900">
            Dokumente von {ownerName}
          </span>
          {renderTierBadge()}
        </div>
      )}

      {/* Info Banner */}
      {showInfoBanner && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
              <p className="text-sm text-blue-800">
                Sie haben Nur-Ansicht-Zugriff auf diese Dokumente. Downloads sind nur verfügbar, wenn der Besitzer ein Premium-Abo hat.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <FolderOpen className="w-16 h-16 text-warmgray-300 mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-warmgray-900 mb-2">
              Keine Dokumente vorhanden
            </h3>
            <p className="text-warmgray-600 max-w-md mx-auto">
              Diese Person hat noch keine Dokumente in ihrem Lebensordner hochgeladen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6" role="list" aria-label="Dokumentenliste nach Kategorien">
          {Object.entries(documentsByCategory).map(([category, docs]) => (
            <Card key={category} role="listitem">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen className="w-5 h-5 text-sage-600" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-warmgray-900">
                    {categories[category] || category}
                  </h2>
                  <span className="text-sm text-warmgray-500">
                    ({docs.length} {docs.length === 1 ? 'Dokument' : 'Dokumente'})
                  </span>
                </div>

                <div className="grid gap-3" role="list" aria-label={`Dokumente in ${categories[category] || category}`}>
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedDoc(doc)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${doc.title} anzeigen`}
                      className="flex items-center gap-4 p-3 rounded-lg border border-warmgray-200 hover:border-sage-300 hover:bg-sage-50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
                    >
                      <div className="shrink-0" aria-hidden="true">
                        {getFileIcon(doc.file_type)}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-medium text-warmgray-900 truncate">{doc.title}</p>
                        <p className="text-sm text-warmgray-500 truncate">{doc.file_name}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3 text-sm text-warmgray-500">
                        {doc.expiry_date && (
                          <span className={`flex items-center gap-1 ${
                            new Date(doc.expiry_date) < new Date()
                              ? 'text-red-600'
                              : new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                ? 'text-amber-600'
                                : ''
                          }`}>
                            <Calendar className="w-4 h-4" aria-hidden="true" />
                            <span aria-label={`Ablaufdatum: ${new Date(doc.expiry_date).toLocaleDateString('de-DE')}`}>
                              {new Date(doc.expiry_date).toLocaleDateString('de-DE')}
                            </span>
                            {new Date(doc.expiry_date) < new Date() && (
                              <AlertTriangle className="w-3 h-3 ml-1" aria-label="Abgelaufen" />
                            )}
                          </span>
                        )}
                        <span className="hidden sm:inline">{formatFileSize(doc.file_size)}</span>
                        <Button variant="ghost" size="sm" className="h-8" aria-label={`${doc.title} anzeigen`}>
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {selectedDoc && getFileIcon(selectedDoc.file_type)}
                {selectedDoc?.title || 'Dokument'}
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Vorschau des Dokuments {selectedDoc?.title}
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar - only show for images with zoom/rotate controls */}
          {canPreview && streamUrl && isImage && (
            <div className="flex flex-wrap items-center gap-2 py-2 px-1 border-b border-warmgray-200" role="toolbar" aria-label="Bildsteuerung">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  aria-label="Verkleinern"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <ZoomOut className="w-4 h-4" aria-hidden="true" />
                </Button>
                <span className="text-xs sm:text-sm text-warmgray-600 min-w-[3rem] sm:min-w-[4rem] text-center" aria-live="polite">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  aria-label="Vergroessern"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <ZoomIn className="w-4 h-4" aria-hidden="true" />
                </Button>
                <div className="w-px h-6 bg-warmgray-200 mx-1 sm:mx-2" aria-hidden="true" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRotate}
                  aria-label="Um 90 Grad drehen"
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <RotateCw className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          {/* Preview Content */}
          <div className="mt-2">
            {renderPreview()}
          </div>

          {/* Document Info */}
          <div className="mt-4 pt-4 border-t border-warmgray-200 space-y-3">
            {/* Expiry Date */}
            {selectedDoc?.expiry_date && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-warmgray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-warmgray-700">Ablaufdatum</p>
                  <p className={`text-sm ${new Date(selectedDoc.expiry_date) < new Date()
                    ? 'text-red-600 font-medium'
                    : new Date(selectedDoc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                      ? 'text-amber-600'
                      : 'text-warmgray-600'
                    }`}>
                    {new Date(selectedDoc.expiry_date).toLocaleDateString('de-DE', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    {new Date(selectedDoc.expiry_date) < new Date() && (
                      <span className="ml-2 inline-flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                        Abgelaufen
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedDoc?.notes && (
              <div className="flex items-start gap-2">
                <StickyNote className="w-4 h-4 text-warmgray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-warmgray-700">Notizen</p>
                  <p className="text-sm text-warmgray-600 whitespace-pre-wrap">{selectedDoc.notes}</p>
                </div>
              </div>
            )}

            {/* File Info */}
            <div className="flex items-center justify-between text-sm text-warmgray-500 pt-2">
              <span>{selectedDoc?.file_name}</span>
              <span>
                {selectedDoc?.file_size
                  ? formatFileSize(selectedDoc.file_size)
                  : ''}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DocumentViewer
