'use client'

import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useVaultSetupContext } from './context'

export function VaultSetupRecoveryKey() {
  const {
    step,
    recoveryKeyHex,
    savedChecked,
    setSavedChecked,
    setStep,
    isGeneratingRecoveryKey,
    startSetup,
  } = useVaultSetupContext()

  if (step !== 3) {
    return null
  }

  const formattedRecoveryKey = recoveryKeyHex ? recoveryKeyHex.replace(/(.{8})/g, '$1 ').trim() : ''

  return (
    <>
      <DialogHeader>
        <DialogTitle>Wiederherstellungsschlüssel</DialogTitle>
        <DialogDescription>
          Bewahren Sie diesen Schlüssel sicher auf, falls Sie Ihr Passwort vergessen.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        ⚠️ Dieser Schlüssel wird nur einmal angezeigt und nicht gespeichert.
      </div>
      <div className="mt-4 rounded-md border border-warmgray-200 bg-warmgray-50 px-4 py-3">
        {recoveryKeyHex ? (
          <code
            tabIndex={0}
            className="font-mono text-sm break-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 rounded"
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !isGeneratingRecoveryKey &&
                savedChecked &&
                /^[0-9a-f]{64}$/i.test(recoveryKeyHex)
              ) {
                event.preventDefault()
                void startSetup()
              }
            }}
          >
            {formattedRecoveryKey}
          </code>
        ) : (
          <div className="flex items-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          onClick={() => navigator.clipboard.writeText(recoveryKeyHex)}
          disabled={!recoveryKeyHex}
        >
          📋 Kopieren
        </Button>
        <Button variant="outline" onClick={() => window.print()} disabled={!recoveryKeyHex}>
          🖨️ Drucken
        </Button>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <input
          id="vault-key-saved"
          type="checkbox"
          checked={savedChecked}
          onChange={(event) => setSavedChecked(event.target.checked)}
        />
        <Label htmlFor="vault-key-saved">Ich habe den Schlüssel gespeichert</Label>
      </div>
      <DialogFooter className="mt-6">
        <Button variant="outline" onClick={() => setStep(2)}>
          Zurück
        </Button>
        <Button
          onClick={startSetup}
          disabled={
            isGeneratingRecoveryKey ||
            !savedChecked ||
            !/^[0-9a-f]{64}$/i.test(recoveryKeyHex)
          }
        >
          Weiter
        </Button>
      </DialogFooter>
    </>
  )
}
