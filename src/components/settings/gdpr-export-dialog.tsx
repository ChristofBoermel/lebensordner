'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

export function GDPRExportDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    setExportSuccess(false)

    try {
      const res = await fetch('/api/export/gdpr-data', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Export fehlgeschlagen')
      }

      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || `lebensordner-data-export.json`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccess(true)
      setTimeout(() => {
        setExportSuccess(false)
      }, 3000)
    } catch {
      setExportError('Der Export konnte nicht durchgeführt werden. Bitte versuchen Sie es erneut.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Meine Daten exportieren (GDPR)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Datenexport (GDPR Art. 20)</DialogTitle>
          <DialogDescription>
            Laden Sie eine vollständige Kopie Ihrer Daten im maschinenlesbaren JSON-Format herunter.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {exportError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {exportError}
            </div>
          )}

          {exportSuccess && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Export erfolgreich heruntergeladen!
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-warmgray-900 mb-2">Enthaltene Daten:</p>
            <ul className="text-sm text-warmgray-600 space-y-1 list-disc list-inside">
              <li>Profildaten (Name, E-Mail, Telefon, Adresse)</li>
              <li>Dokumenten-Metadaten (Titel, Kategorie, Dateigröße)</li>
              <li>Einwilligungsverlauf</li>
              <li>Sicherheits-Aktivitätsprotokoll</li>
              <li>Vertrauenspersonen</li>
              <li>Erinnerungen</li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium text-warmgray-900 mb-2">Nicht enthalten:</p>
            <ul className="text-sm text-warmgray-500 space-y-1 list-disc list-inside">
              <li>Dokumenten-Dateien (nutzen Sie die Export-Seite)</li>
              <li>Zahlungsinformationen</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportieren...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                JSON herunterladen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
