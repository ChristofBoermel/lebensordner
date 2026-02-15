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
import { Loader2, AlertTriangle, ShieldAlert, FileWarning } from 'lucide-react'

interface HealthConsentWithdrawalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onWithdrawn: () => void
}

export function HealthConsentWithdrawalDialog({
  open,
  onOpenChange,
  onWithdrawn,
}: HealthConsentWithdrawalDialogProps) {
  const [confirmationChecked, setConfirmationChecked] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (isWithdrawing) return
    setConfirmationChecked(false)
    setError(null)
    onOpenChange(false)
  }

  const handleWithdraw = async () => {
    if (!confirmationChecked || isWithdrawing) return

    setIsWithdrawing(true)
    setError(null)

    try {
      const response = await fetch('/api/consent/withdraw-health-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error || 'Fehler beim Widerruf. Bitte versuchen Sie es erneut.')
        setIsWithdrawing(false)
        return
      }

      onWithdrawn()
      handleClose()
    } catch {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.')
      setIsWithdrawing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg"
        data-testid="health-consent-withdrawal-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            Einwilligung zur Gesundheitsdatenverarbeitung widerrufen?
          </DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileWarning className="w-4 h-4 text-red-600" />
              <p className="font-medium text-red-800 text-sm">
                Wenn Sie Ihre Einwilligung widerrufen, werden alle Ihre Gesundheitsdaten unwiderruflich gelöscht:
              </p>
            </div>
            <ul className="text-sm text-red-700 space-y-1 ml-6 list-disc">
              <li>Medizinische Diagnosen und Erkrankungen</li>
              <li>Medikamente und Dosierungen</li>
              <li>Allergien und Unverträglichkeiten</li>
              <li>Blutgruppe</li>
              <li>Notfallkontakte</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">
              Wichtig: Die Notfall-Funktion wird deaktiviert und kann nicht mehr verwendet werden. Sie können die Einwilligung jederzeit erneut erteilen, müssen dann aber alle Daten neu eingeben.
            </p>
          </div>

          <Separator />

          <div className="rounded-lg border border-warmgray-200 bg-warmgray-50 p-3">
            <div className="flex items-start gap-3">
              <Input
                id="health_withdraw_confirm"
                type="checkbox"
                checked={confirmationChecked}
                onChange={(e) => setConfirmationChecked(e.target.checked)}
                data-testid="health-withdraw-confirm"
                className="!h-4 !w-4 !p-0 !px-0 !py-0 !border !border-warmgray-400 !bg-white !text-sage-600 !rounded-sm !shadow-none !block focus:!ring-0 focus-visible:!ring-0 focus-visible:!outline-none"
              />
              <Label htmlFor="health_withdraw_confirm" className="text-sm text-warmgray-700">
                Ich verstehe, dass alle meine Gesundheitsdaten unwiderruflich gelöscht werden.
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isWithdrawing}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleWithdraw}
            disabled={!confirmationChecked || isWithdrawing}
            className="bg-red-600 hover:bg-red-700"
          >
            {isWithdrawing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Widerrufen...
              </>
            ) : (
              'Einwilligung widerrufen'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
