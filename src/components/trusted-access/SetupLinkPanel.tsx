'use client'

import { useState } from 'react'
import { Copy, CheckCircle2, Clock, Mail, Shield, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SetupLinkPanelProps {
  recipientName: string
  recipientEmail: string
  setupUrl: string
  expiresAt: string
  onDismiss: () => void
}

export function SetupLinkPanel({
  recipientName,
  recipientEmail,
  setupUrl,
  expiresAt,
  onDismiss,
}: SetupLinkPanelProps) {
  const [copied, setCopied] = useState(false)

  const expiryDate = new Date(expiresAt)
  const expiryLabel = expiryDate.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  async function handleCopy() {
    await navigator.clipboard.writeText(setupUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        onDismiss()
      }
    }}>
      <DialogContent className="border-sage-300 bg-sage-50 sm:max-w-xl">
        <DialogHeader className="space-y-2 pr-8">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 flex-shrink-0 text-sage-600" />
            <DialogTitle className="text-left text-base text-sage-900">
              Sicherer Zugriffslink erstellt
            </DialogTitle>
          </div>
          <DialogDescription className="text-left text-sm text-sage-800">
            Senden Sie den Link jetzt an {recipientName}, damit die Einrichtung auf dem eingeladenen Geraet abgeschlossen werden kann.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-sage-200 bg-white px-3 py-2">
            <span className="truncate font-mono text-xs text-warmgray-600 flex-1">
              {setupUrl}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-7 flex-shrink-0 px-2 text-sage-700 hover:bg-sage-100"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-sage-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5 text-xs">
                {copied ? 'Kopiert' : 'Kopieren'}
              </span>
            </Button>
          </div>

          <div className="space-y-1.5 text-xs text-sage-800">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sage-600" />
              <span>
                Senden Sie diesen Link manuell an <strong>{recipientName}</strong> (
                {recipientEmail}). Sie müssen sich mit genau dieser E-Mail-Adresse
                anmelden.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sage-600" />
              <span>
                Link gueltig bis <strong>{expiryLabel} Uhr</strong> - danach neuen
                Link erstellen.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sage-600" />
              <span>
                {recipientName} muss einen E-Mail-Code bestaetigen und dieses Geraet
                einrichten.
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onDismiss}
            className="w-full border-sage-300 text-sage-700 hover:bg-sage-100"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Verstanden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
