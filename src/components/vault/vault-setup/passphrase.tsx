'use client'

import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVaultSetupContext } from './context'

export function VaultSetupPassphrase() {
  const {
    step,
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    error,
    setStep,
    goToRecoveryKeyStep,
  } = useVaultSetupContext()

  if (step !== 2) {
    return null
  }

  const classes = [
    /[a-z]/.test(passphrase),
    /[A-Z]/.test(passphrase),
    /[0-9]/.test(passphrase),
    /[^A-Za-z0-9]/.test(passphrase),
  ].filter(Boolean).length

  let strengthLabel = 'Schwach'
  let strengthPercent = 33
  let strengthColor = 'bg-red-500'

  if (passphrase.length >= 12 && classes >= 2) {
    strengthLabel = 'Mittel'
    strengthPercent = 66
    strengthColor = 'bg-amber-500'
  }

  if ((passphrase.length >= 12 && classes === 4) || (passphrase.length >= 16 && classes >= 3)) {
    strengthLabel = 'Stark'
    strengthPercent = 100
    strengthColor = 'bg-emerald-500'
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Passwort wählen</DialogTitle>
        <DialogDescription>
          Wählen Sie ein starkes Passwort, das Sie sich merken können.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-4">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="space-y-2">
          <Label htmlFor="vault-passphrase">Passwort</Label>
          <Input
            id="vault-passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vault-passphrase-confirm">Passwort bestätigen</Label>
          <Input
            id="vault-passphrase-confirm"
            type="password"
            value={confirmPassphrase}
            onChange={(event) => setConfirmPassphrase(event.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-warmgray-600 mb-1">
            <span>Passwortstärke</span>
            <span>{strengthLabel}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-warmgray-100">
            <div className={`h-2 rounded-full ${strengthColor}`} style={{ width: `${strengthPercent}%` }} />
          </div>
        </div>
      </div>
      <DialogFooter className="mt-6">
        <Button variant="outline" onClick={() => setStep(1)}>
          Zurück
        </Button>
        <Button
          onClick={goToRecoveryKeyStep}
          disabled={passphrase.length < 12 || passphrase !== confirmPassphrase}
        >
          Weiter
        </Button>
      </DialogFooter>
    </>
  )
}
