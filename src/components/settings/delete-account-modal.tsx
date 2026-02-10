'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2, AlertTriangle, Trash2, ShieldAlert, FileWarning, Users } from 'lucide-react'

interface DeleteAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteAccountModal({ open, onOpenChange, onDeleted }: DeleteAccountModalProps) {
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFormValid = password.length > 0 && confirmText === 'DELETE'

  const handleClose = () => {
    if (isDeleting) return
    setPassword('')
    setConfirmText('')
    setError(null)
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!isFormValid || isDeleting) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 401) {
          setError('Das eingegebene Passwort ist nicht korrekt.')
        } else {
          setError(data.error || 'Fehler beim L\u00f6schen des Kontos.')
        }
        setIsDeleting(false)
        return
      }

      onDeleted()
    } catch {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.')
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            Konto endg&uuml;ltig l&ouml;schen
          </DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht r&uuml;ckg&auml;ngig gemacht werden. Bitte lesen Sie die folgenden Informationen sorgf&auml;ltig durch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* What will be deleted */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileWarning className="w-4 h-4 text-red-600" />
              <p className="font-medium text-red-800 text-sm">Was gel&ouml;scht wird:</p>
            </div>
            <ul className="text-sm text-red-700 space-y-1 ml-6 list-disc">
              <li>Alle hochgeladenen Dokumente</li>
              <li>Ihr Profil und pers&ouml;nliche Daten</li>
              <li>Vertrauenspersonen und Zugriffsrechte</li>
              <li>Erinnerungen und Benachrichtigungen</li>
              <li>Einwilligungsprotokolle</li>
            </ul>
          </div>

          {/* What will be retained */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="font-medium text-amber-800 text-sm">Was aufbewahrt wird:</p>
            </div>
            <p className="text-sm text-amber-700 ml-6">
              Abrechnungsdaten werden gem&auml;&szlig; &sect;147 AO (Abgabenordnung) f&uuml;r 7 Jahre aufbewahrt. Stripe-Kundendaten werden mit einem L&ouml;schvermerk versehen.
            </p>
          </div>

          {/* Anonymized audit log retention */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <p className="font-medium text-amber-800 text-sm">Sicherheitsprotokolle:</p>
            </div>
            <p className="text-sm text-amber-700 ml-6">
              Sicherheitsprotokolle werden anonymisiert aufbewahrt (ohne persönliche Zuordnung) für Compliance-Zwecke gemäß DSGVO Art. 6 Abs. 1 lit. c.
            </p>
          </div>

          {/* Trusted person notification */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="font-medium text-blue-800 text-sm">Benachrichtigung:</p>
            </div>
            <p className="text-sm text-blue-700 ml-6">
              Alle Ihre Vertrauenspersonen werden per E-Mail &uuml;ber die Kontol&ouml;schung informiert.
            </p>
          </div>

          <Separator />

          {/* Password input */}
          <div className="space-y-2">
            <Label htmlFor="delete_password">Passwort best&auml;tigen *</Label>
            <Input
              id="delete_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ihr aktuelles Passwort"
              disabled={isDeleting}
            />
          </div>

          {/* Confirmation text */}
          <div className="space-y-2">
            <Label htmlFor="delete_confirm">
              Geben Sie <span className="font-mono font-bold text-red-600">DELETE</span> ein, um zu best&auml;tigen *
            </Label>
            <Input
              id="delete_confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={isDeleting}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isFormValid || isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                L&ouml;schen...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Konto endg&uuml;ltig l&ouml;schen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
