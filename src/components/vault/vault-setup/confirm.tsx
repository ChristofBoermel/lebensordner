'use client'

import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useVaultSetupContext } from './context'

export function VaultSetupConfirm() {
  const {
    step,
    isLoading,
    isTimedOut,
    error,
    retrySetup,
    cancelSetup,
    onClose,
  } = useVaultSetupContext()

  if (step !== 4) {
    return null
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Einrichtung abschließen</DialogTitle>
        <DialogDescription>
          Wir richten Ihren Tresor ein und verschlüsseln die Schlüssel.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-6 flex items-center gap-3 text-sm text-warmgray-700">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isLoading ? 'Tresor wird eingerichtet...' : 'Tresor eingerichtet'}
      </div>
      {!isLoading && isTimedOut ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Die Verbindung hat zu lange gedauert. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.
        </div>
      ) : null}
      {!isLoading && error && !isTimedOut ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
      <DialogFooter className="mt-6">
        {isLoading ? (
          <Button variant="outline" onClick={cancelSetup}>
            Abbrechen
          </Button>
        ) : null}
        {!isLoading && isTimedOut ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button onClick={retrySetup}>Erneut versuchen</Button>
          </>
        ) : null}
        {!isLoading && !isTimedOut && !error ? <Button onClick={onClose}>Schließen</Button> : null}
      </DialogFooter>
    </>
  )
}
