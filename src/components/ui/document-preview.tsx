'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FileText,
  Image as ImageIcon,
  File,
  Download,
  X,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Calendar,
  StickyNote,
  AlertTriangle
} from 'lucide-react'

interface DocumentPreviewProps {
  isOpen: boolean
  onClose: () => void
  document: {
    id: string
    title: string
    file_name: string
    file_path: string
    file_type: string
    file_size: number
    expiry_date?: string | null
    notes?: string | null
    category?: string
  } | null
}

export function DocumentPreview({ isOpen, onClose, document }: DocumentPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    if (!document || !isOpen) {
      setPreviewUrl(null)
      setIsLoading(false)
      return
    }

    const loadPreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .storage
          .from('documents')
          .createSignedUrl(document.file_path, 3600) // 1 hour expiry

        if (error) throw error
        setPreviewUrl(data.signedUrl)
      } catch (err) {
        console.error('Preview error:', err)
        setError('Vorschau konnte nicht geladen werden')
      } finally {
        setIsLoading(false)
      }
    }

    loadPreview()
  }, [document, isOpen, supabase])

  // Reset zoom and rotation when document changes
  useEffect(() => {
    setZoom(100)
    setRotation(0)
  }, [document?.id])

  const handleDownload = async () => {
    if (!previewUrl || !document) return

    try {
      const response = await fetch(previewUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document.file_name
      window.document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      window.document.body.removeChild(a)
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)
  const handleFullscreen = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank')
    }
  }

  const isImage = document?.file_type?.startsWith('image/')
  const isPDF = document?.file_type === 'application/pdf'
  const canPreview = isImage || isPDF

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-warmgray-500">
          <File className="w-16 h-16 mb-4" />
          <p>{error}</p>
        </div>
      )
    }

    if (!previewUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-warmgray-500">
          <File className="w-16 h-16 mb-4" />
          <p>Keine Vorschau verfügbar</p>
        </div>
      )
    }

    if (isImage) {
      return (
        <div className="relative overflow-auto max-h-[calc(100vh-12rem)] flex items-center justify-center bg-warmgray-100 rounded-lg">
          <img
            src={previewUrl}
            alt={document?.title || 'Dokument'}
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
            src={`${previewUrl}#toolbar=0`}
            className="w-full max-h-[calc(100vh-12rem)] border-0"
            style={{ height: 'calc(100vh - 12rem)' }}
            title={document?.title || 'PDF Vorschau'}
          />
        </div>
      )
    }

    // Unsupported file type
    return (
      <div className="flex flex-col items-center justify-center h-96 text-warmgray-500">
        <FileText className="w-16 h-16 mb-4" />
        <p className="mb-2">Vorschau für diesen Dateityp nicht verfügbar</p>
        <p className="text-sm">{document?.file_type}</p>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isImage ? (
                <ImageIcon className="w-5 h-5 text-sage-600" />
              ) : isPDF ? (
                <FileText className="w-5 h-5 text-sage-600" />
              ) : (
                <File className="w-5 h-5 text-sage-600" />
              )}
              {document?.title || 'Dokument'}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Vorschau des Dokuments {document?.title}
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        {canPreview && previewUrl && !isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-1 border-b border-warmgray-200">
            <div className="flex items-center gap-1 sm:gap-2">
              {isImage && (
                <>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleZoomOut}
                          disabled={zoom <= 50}
                          className="h-10 w-10 sm:h-11 sm:w-11 min-h-[44px]"
                          aria-label="Verkleinern"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Verkleinern</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="text-xs sm:text-sm text-warmgray-600 min-w-[3rem] sm:min-w-[4rem] text-center">
                    {zoom}%
                  </span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleZoomIn}
                          disabled={zoom >= 200}
                          className="h-10 w-10 sm:h-11 sm:w-11 min-h-[44px]"
                          aria-label="Vergrößern"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Vergrößern</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="w-px h-6 bg-warmgray-200 mx-1 sm:mx-2" />
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleRotate}
                          className="h-10 w-10 sm:h-11 sm:w-11 min-h-[44px]"
                          aria-label="Drehen"
                        >
                          <RotateCw className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Drehen</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleFullscreen}
                      className="h-10 w-10 sm:h-11 sm:w-11 min-h-[44px]"
                      aria-label="In neuem Tab öffnen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>In neuem Tab öffnen</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-10 sm:h-11 min-h-[44px] px-4"
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Herunterladen</span>
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
          {document?.expiry_date && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-warmgray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-warmgray-700">Ablaufdatum</p>
                <p className={`text-sm ${new Date(document.expiry_date) < new Date()
                  ? 'text-red-600 font-medium'
                  : new Date(document.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    ? 'text-amber-600'
                    : 'text-warmgray-600'
                  }`}>
                  {new Date(document.expiry_date).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                  {new Date(document.expiry_date) < new Date() && (
                    <span className="ml-2 inline-flex items-center gap-1 text-red-600">
                      <AlertTriangle className="w-3 h-3" />
                      Abgelaufen
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {document?.notes && (
            <div className="flex items-start gap-2">
              <StickyNote className="w-4 h-4 text-warmgray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-warmgray-700">Notizen</p>
                <p className="text-sm text-warmgray-600 whitespace-pre-wrap">{document.notes}</p>
              </div>
            </div>
          )}

          {/* File Info */}
          <div className="flex items-center justify-between text-sm text-warmgray-500 pt-2">
            <span>{document?.file_name}</span>
            <span>
              {document?.file_size
                ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB`
                : ''}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
