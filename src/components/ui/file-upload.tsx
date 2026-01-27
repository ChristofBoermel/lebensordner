'use client'

import { useCallback, useState } from 'react'
import { useDropzone, Accept } from 'react-dropzone'
import { Upload, File, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  onClear: () => void
  accept?: Accept
  maxSize?: number // in bytes
  className?: string
}

const DEFAULT_ACCEPT: Accept = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024 // 25 MB

export function FileUpload({
  onFileSelect,
  selectedFile,
  onClear,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  className,
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null)

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`Die Datei ist zu groß. Maximum: ${formatFileSize(maxSize)}`)
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Dieser Dateityp wird nicht unterstützt.')
      } else {
        setError('Die Datei konnte nicht hochgeladen werden.')
      }
      return
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
    }
  }, [onFileSelect, maxSize])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: File) => {
    const type = file.type
    if (type.startsWith('image/')) {
      return (
        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
          <File className="w-6 h-6 text-blue-600" />
        </div>
      )
    }
    if (type === 'application/pdf') {
      return (
        <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
          <File className="w-6 h-6 text-red-600" />
        </div>
      )
    }
    return (
      <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center">
        <File className="w-6 h-6 text-sage-600" />
      </div>
    )
  }

  // Show selected file
  if (selectedFile) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-sage-50 border border-sage-200 overflow-hidden">
          <div className="flex-shrink-0">
            {getFileIcon(selectedFile)}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-medium text-warmgray-900 truncate max-w-full" title={selectedFile.name}>
              {selectedFile.name}
            </p>
            <p className="text-sm text-warmgray-500">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="text-warmgray-400 hover:text-warmgray-600"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
          isDragActive && !isDragReject && 'border-sage-500 bg-sage-50',
          isDragReject && 'border-red-500 bg-red-50',
          !isDragActive && 'border-warmgray-300 hover:border-sage-400 hover:bg-warmgray-50'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
            isDragActive && !isDragReject && 'bg-sage-100',
            isDragReject && 'bg-red-100',
            !isDragActive && 'bg-warmgray-100'
          )}>
            <Upload className={cn(
              'w-7 h-7',
              isDragActive && !isDragReject && 'text-sage-600',
              isDragReject && 'text-red-600',
              !isDragActive && 'text-warmgray-400'
            )} />
          </div>
          
          {isDragActive && !isDragReject ? (
            <div>
              <p className="font-medium text-sage-700">Datei hier ablegen</p>
              <p className="text-sm text-sage-600 mt-1">Lassen Sie die Datei los zum Hochladen</p>
            </div>
          ) : isDragReject ? (
            <div>
              <p className="font-medium text-red-700">Dateityp nicht erlaubt</p>
              <p className="text-sm text-red-600 mt-1">Bitte wählen Sie eine gültige Datei</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-warmgray-700">
                Datei hierher ziehen oder <span className="text-sage-600">durchsuchen</span>
              </p>
              <p className="text-sm text-warmgray-500 mt-1">
                PDF, JPG, PNG oder Word (max. {formatFileSize(maxSize)})
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
