"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, AlertTriangle, Camera, Upload, Edit2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { parseBmpXml } from '@/lib/bmp/bmp-xml-parser'
import type { Medication } from '@/types/medication'

interface BmpScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMedicationsScanned: (medications: Medication[]) => Promise<void>
  existingMedications: Medication[]
  medicalInfoId?: string
}

type ScanState = 'idle' | 'scanning' | 'preview' | 'saving' | 'error'

function PreviewEditDialog({
  open,
  onOpenChange,
  medication,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  medication: Medication | null
  onSave: (med: Medication) => void
}) {
  const [form, setForm] = useState<Medication>({ wirkstoff: '' })

  useEffect(() => {
    if (open && medication) {
      setForm({ ...medication })
    }
  }, [medication, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Medikament bearbeiten</DialogTitle>
          <DialogDescription>Felder mit * sind Pflichtfelder</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preview-field-wirkstoff">Wirkstoff *</Label>
            <Input
              id="preview-field-wirkstoff"
              value={form.wirkstoff}
              onChange={(e) => setForm({ ...form, wirkstoff: e.target.value })}
              placeholder="z.B. Metformin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-field-handelsname">Handelsname (optional)</Label>
            <Input
              id="preview-field-handelsname"
              value={form.handelsname ?? ''}
              onChange={(e) => setForm({ ...form, handelsname: e.target.value })}
              placeholder="z.B. Glucophage"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preview-field-staerke">Stärke</Label>
              <Input
                id="preview-field-staerke"
                value={form.staerke ?? ''}
                onChange={(e) => setForm({ ...form, staerke: e.target.value })}
                placeholder="z.B. 500 mg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-field-form">Form</Label>
              <Input
                id="preview-field-form"
                value={form.form ?? ''}
                onChange={(e) => setForm({ ...form, form: e.target.value })}
                placeholder="z.B. Tablette"
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-warmgray-700 mb-2">Dosierung</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label htmlFor="preview-field-morgens" className="text-xs text-center block">morgens</Label>
                <Input
                  id="preview-field-morgens"
                  value={form.morgens ?? ''}
                  onChange={(e) => setForm({ ...form, morgens: e.target.value })}
                  className="text-center"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="preview-field-mittags" className="text-xs text-center block">mittags</Label>
                <Input
                  id="preview-field-mittags"
                  value={form.mittags ?? ''}
                  onChange={(e) => setForm({ ...form, mittags: e.target.value })}
                  className="text-center"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="preview-field-abends" className="text-xs text-center block">abends</Label>
                <Input
                  id="preview-field-abends"
                  value={form.abends ?? ''}
                  onChange={(e) => setForm({ ...form, abends: e.target.value })}
                  className="text-center"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="preview-field-zur-nacht" className="text-xs text-center block">zur Nacht</Label>
                <Input
                  id="preview-field-zur-nacht"
                  value={form.zur_nacht ?? ''}
                  onChange={(e) => setForm({ ...form, zur_nacht: e.target.value })}
                  className="text-center"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preview-field-einheit">Einheit</Label>
              <Input
                id="preview-field-einheit"
                value={form.einheit ?? ''}
                onChange={(e) => setForm({ ...form, einheit: e.target.value })}
                placeholder="z.B. Tablette(n)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview-field-grund">Grund</Label>
              <Input
                id="preview-field-grund"
                value={form.grund ?? ''}
                onChange={(e) => setForm({ ...form, grund: e.target.value })}
                placeholder="z.B. Diabetes Typ 2"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-field-hinweise">Hinweise</Label>
            <Input
              id="preview-field-hinweise"
              value={form.hinweise ?? ''}
              onChange={(e) => setForm({ ...form, hinweise: e.target.value })}
              placeholder="z.B. mit Mahlzeit einnehmen"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => onSave(form)}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BmpScanDialog({
  open,
  onOpenChange,
  onMedicationsScanned,
}: BmpScanDialogProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [scannedMedications, setScannedMedications] = useState<Medication[]>([])
  const [editingPreviewMed, setEditingPreviewMed] = useState<{ med: Medication; index: number } | null>(null)
  const [isPreviewEditOpen, setIsPreviewEditOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)

  const resetToIdle = useCallback(() => {
    setScanState('idle')
    setErrorMessage(null)
    setScannedMedications([])
    setCameraError(null)
  }, [])

  // Camera cleanup effect
  useEffect(() => {
    if (!open || activeTab !== 'camera') {
      readerRef.current?.reset()
    }
    if (!open) {
      resetToIdle()
    }
  }, [open, activeTab, resetToIdle])

  // Stop camera when entering error or saving state
  useEffect(() => {
    if (open && activeTab === 'camera' && (scanState === 'error' || scanState === 'saving')) {
      readerRef.current?.reset()
    }
  }, [scanState, activeTab, open])

  // Camera start effect
  useEffect(() => {
    if (!open || activeTab !== 'camera' || scanState === 'preview') return

    let cancelled = false

    const startCamera = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library')
        if (cancelled) return

        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        await reader.decodeFromVideoDevice(
          null,
          videoRef.current,
          (result, err) => {
            if (result && !cancelled) {
              reader.reset()
              const meds = parseBmpXml(result.getText())
              if (meds.length > 0) {
                setScannedMedications(meds)
                setScanState('preview')
              } else {
                setScanState('error')
                setErrorMessage('Kein BMP-Medikationsplan erkannt. Bitte prüfen Sie das Bild.')
              }
            }
            // Ignore intermediate errors from continuous scanning
          }
        )
      } catch (err: any) {
        if (cancelled) return
        if (err?.name === 'NotAllowedError') {
          setCameraError('Kamerazugriff verweigert. Bitte laden Sie stattdessen ein Foto hoch.')
        } else {
          setCameraError('Kamera konnte nicht gestartet werden. Bitte laden Sie stattdessen ein Foto hoch.')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      readerRef.current?.reset()
    }
  }, [open, activeTab, scanState])

  const handleFileDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setScanState('scanning')
    const objectUrl = URL.createObjectURL(file)

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeFromImageUrl(objectUrl)
      URL.revokeObjectURL(objectUrl)

      const meds = parseBmpXml(result.getText())
      if (meds.length > 0) {
        setScannedMedications(meds)
        setScanState('preview')
      } else {
        setScanState('error')
        setErrorMessage('Kein BMP-Medikationsplan erkannt. Bitte prüfen Sie das Bild.')
      }
    } catch {
      URL.revokeObjectURL(objectUrl)
      setScanState('error')
      setErrorMessage('Kein Barcode erkannt. Bitte stellen Sie sicher, dass der Data-Matrix-Barcode gut sichtbar ist.')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    onDrop: handleFileDrop,
    noClick: true,
    noKeyboard: true,
  })

  const handleConfirm = async () => {
    setScanState('saving')
    try {
      await onMedicationsScanned(scannedMedications)
      onOpenChange(false)
      resetToIdle()
    } catch {
      setScanState('error')
      setErrorMessage('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    }
  }

  const handlePreviewEditSave = (med: Medication) => {
    if (editingPreviewMed === null) return
    const updated = scannedMedications.map((m, i) =>
      i === editingPreviewMed.index ? med : m
    )
    setScannedMedications(updated)
    setIsPreviewEditOpen(false)
    setEditingPreviewMed(null)
  }

  const renderPreview = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          Bitte prüfen Sie die erkannten Medikamente. Beim Übernehmen wird Ihre bisherige Liste ersetzt.
        </p>
      </div>

      <p className="text-sm text-warmgray-600">
        {scannedMedications.length} Medikament{scannedMedications.length !== 1 ? 'e' : ''} erkannt
      </p>

      <div className="max-h-64 overflow-y-auto space-y-2">
        {scannedMedications.map((med, index) => {
          const isPznOnly = !!med.pzn && !med.wirkstoff
          const doseParts: string[] = []
          if (med.morgens && med.morgens !== '0') doseParts.push(`morgens ${med.morgens}`)
          if (med.mittags && med.mittags !== '0') doseParts.push(`mittags ${med.mittags}`)
          if (med.abends && med.abends !== '0') doseParts.push(`abends ${med.abends}`)
          if (med.zur_nacht && med.zur_nacht !== '0') doseParts.push(`zur Nacht ${med.zur_nacht}`)
          if (med.einheit && doseParts.length > 0) {
            doseParts[doseParts.length - 1] += ` ${med.einheit}`
          }
          if (med.grund) doseParts.push(`· Grund: ${med.grund}`)
          const doseString = doseParts.join(' · ')

          return (
            <div
              key={index}
              className="flex items-start justify-between p-3 rounded-lg bg-cream-50 border border-cream-200 gap-2"
            >
              <div className="flex-1 min-w-0">
                {isPznOnly ? (
                  <>
                    <p className="font-medium text-warmgray-900">PZN: {med.pzn}</p>
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      Bitte Wirkstoff ergänzen
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-warmgray-900">
                      {med.wirkstoff}
                      {(med.staerke || med.form) && (
                        <span className="text-warmgray-500 font-normal ml-2 text-sm">
                          {[med.staerke, med.form].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </p>
                    {doseString && (
                      <p className="text-xs text-warmgray-600 mt-0.5">{doseString}</p>
                    )}
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                onClick={() => {
                  setEditingPreviewMed({ med, index })
                  setIsPreviewEditOpen(true)
                }}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )
        })}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={resetToIdle}>
          Abbrechen
        </Button>
        <Button onClick={handleConfirm} disabled={scanState === 'saving'}>
          {scanState === 'saving' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Übernehmen
        </Button>
      </DialogFooter>
    </div>
  )

  const renderError = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-red-700">{errorMessage}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={resetToIdle}>
          Erneut versuchen
        </Button>
      </DialogFooter>
    </div>
  )

  const renderTabContent = () => (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'camera')}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload" className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Bild hochladen
        </TabsTrigger>
        <TabsTrigger value="camera" className="flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Kamera
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-4">
        {scanState === 'scanning' ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
            <p className="text-sm text-warmgray-600">Barcode wird erkannt…</p>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragActive
                ? 'border-sage-400 bg-sage-50'
                : 'border-warmgray-300 hover:border-sage-300'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 text-warmgray-400 mx-auto mb-3" />
            <p className="text-sm text-warmgray-600 mb-1">
              {isDragActive
                ? 'Bild hier ablegen…'
                : 'Foto des Bundesmedikationsplans hier ablegen'}
            </p>
            <p className="text-xs text-warmgray-400 mb-4">JPEG, PNG oder WebP</p>
            <Button type="button" variant="outline" size="sm" onClick={openFileDialog}>
              Datei auswählen
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="camera" className="mt-4">
        {cameraError ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">{cameraError}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg bg-warmgray-100"
            />
            <p className="text-xs text-warmgray-500 text-center">
              Halten Sie den Data-Matrix-Barcode vor die Kamera
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Bundesmedikationsplan scannen
            </DialogTitle>
            <DialogDescription>
              Scannen Sie den Data-Matrix-Barcode auf Ihrem Bundesmedikationsplan.
            </DialogDescription>
          </DialogHeader>

          {scanState === 'preview' || scanState === 'saving'
            ? renderPreview()
            : scanState === 'error'
            ? renderError()
            : renderTabContent()}
        </DialogContent>
      </Dialog>

      <PreviewEditDialog
        open={isPreviewEditOpen}
        onOpenChange={setIsPreviewEditOpen}
        medication={editingPreviewMed?.med ?? null}
        onSave={handlePreviewEditSave}
      />
    </>
  )
}
