'use client'

import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useVaultSetupContext } from './context'

export function VaultSetupIntro() {
  const { step, setStep } = useVaultSetupContext()

  if (step !== 1) {
    return null
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>🔐 Dokument-Tresor einrichten</DialogTitle>
        <DialogDescription>
          Ihre Dokumente werden Ende-zu-Ende verschlüsselt. Das bedeutet, dass nur Sie Zugriff haben.
          Wir speichern keine Entschlüsselungsschlüssel auf dem Server.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 rounded-md border border-warmgray-200 bg-warmgray-50 px-4 py-3 text-sm text-warmgray-700">
        Ihr Passwort verlässt niemals Ihr Gerät. Wir können es nicht zurücksetzen.
      </div>
      <DialogFooter className="mt-6">
        <Button onClick={() => setStep(2)}>Weiter</Button>
      </DialogFooter>
    </>
  )
}
