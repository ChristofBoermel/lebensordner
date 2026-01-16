'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
  Maximize2
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
        <div className="relative overflow-auto max-h-[70vh] flex items-center justify-center bg-warmgray-100 rounded-lg">
          <img
            src={previewUrl}
            alt={document?.title || 'Dokument'}
            className="max-w-full transition-transform duration-200"
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
            className="w-full h-[70vh] border-0"
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
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
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
        </DialogHeader>

        {/* Toolbar */}
        {canPreview && previewUrl && !isLoading && (
          <div className="flex items-center justify-between py-2 px-1 border-b border-warmgray-200">
            <div className="flex items-center gap-2">
              {isImage && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                    title="Verkleinern"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-warmgray-600 min-w-[4rem] text-center">
                    {zoom}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                    title="Vergrößern"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-warmgray-200 mx-2" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRotate}
                    title="Drehen"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFullscreen}
                title="In neuem Tab öffnen"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                Herunterladen
              </Button>
            </div>
          </div>
        )}

        {/* Preview Content */}
        <div className="mt-2">
          {renderPreview()}
        </div>

        {/* File Info */}
        <div className="mt-4 pt-4 border-t border-warmgray-200">
          <div className="flex items-center justify-between text-sm text-warmgray-500">
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
