'use client'

import { createContext, use, useState, type ReactElement } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Fingerprint, Loader2 } from 'lucide-react'
import { useVault } from '@/lib/vault/VaultContext'

type VaultUnlockContextValue = {
  mode: 'passphrase' | 'recovery'
  setMode: (mode: 'passphrase' | 'recovery') => void
  recoveryIntent: 'unlock' | 'reset'
  setRecoveryIntent: (intent: 'unlock' | 'reset') => void
  passphrase: string
  setPassphrase: (value: string) => void
  recoveryKey: string
  setRecoveryKey: (value: string) => void
  newPassphrase: string
  setNewPassphrase: (value: string) => void
  confirmNewPassphrase: string
  setConfirmNewPassphrase: (value: string) => void
  isLoading: boolean
  error: string | null
  handleUnlock: () => Promise<void>
  hasBiometricSetup: boolean
  isBiometricSupported: boolean
  unlockWithBiometric: () => Promise<void>
  onClose: () => void
}

const VaultUnlockContext = createContext<VaultUnlockContextValue | null>(null)

function useVaultUnlockContext() {
  const context = use(VaultUnlockContext)
  if (!context) {
    throw new Error('VaultUnlock components must be used within VaultUnlockModal')
  }
  return context
}

function VaultUnlockPassphrase() {
  const {
    passphrase,
    setPassphrase,
    setMode,
    isLoading,
    error,
    handleUnlock,
    hasBiometricSetup,
    isBiometricSupported,
    unlockWithBiometric,
    onClose
  } = useVaultUnlockContext()
  const [isBiometricLoading, setIsBiometricLoading] = useState(false)
  const [biometricError, setBiometricError] = useState<string | null>(null)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void handleUnlock()
      }}
    >
      <div className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="vault-unlock-passphrase">Passwort</Label>
          <Input
            id="vault-unlock-passphrase"
            type="password"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
          />
        </div>
        <Button type="button" variant="link" className="px-0" onClick={() => setMode('recovery')}>
          Wiederherstellungsschlussel verwenden
        </Button>
        {hasBiometricSetup && isBiometricSupported ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading || isBiometricLoading}
              onClick={async () => {
                setBiometricError(null)
                setIsBiometricLoading(true)
                try {
                  await unlockWithBiometric()
                  onClose()
                } catch {
                  setBiometricError('Biometrische Authentifizierung fehlgeschlagen')
                } finally {
                  setIsBiometricLoading(false)
                }
              }}
            >
              <Fingerprint className="mr-2 h-4 w-4" />
              Mit Biometrie entsperren
            </Button>
            {biometricError ? (
              <div className="text-sm text-red-600">{biometricError}</div>
            ) : null}
          </>
        ) : null}
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <DialogFooter className="mt-6">
        <Button type="submit" disabled={isLoading || !passphrase}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Entsperren
        </Button>
      </DialogFooter>
    </form>
  )
}

function VaultUnlockRecovery() {
  const {
    recoveryIntent,
    setRecoveryIntent,
    recoveryKey,
    setRecoveryKey,
    newPassphrase,
    setNewPassphrase,
    confirmNewPassphrase,
    setConfirmNewPassphrase,
    setMode,
    isLoading,
    error,
    handleUnlock
  } = useVaultUnlockContext()

  const isResetValid =
    newPassphrase.length >= 12 && confirmNewPassphrase.length > 0 && newPassphrase === confirmNewPassphrase

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void handleUnlock()
      }}
    >
      <div className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="vault-unlock-recovery">Wiederherstellungsschlussel</Label>
          <Input
            id="vault-unlock-recovery"
            type="text"
            className="font-mono"
            value={recoveryKey}
            onChange={e => setRecoveryKey(e.target.value)}
          />
        </div>
        {recoveryIntent === 'reset' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="vault-reset-passphrase">Neues Passwort</Label>
              <Input
                id="vault-reset-passphrase"
                type="password"
                value={newPassphrase}
                onChange={e => setNewPassphrase(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vault-reset-passphrase-confirm">Neues Passwort bestätigen</Label>
              <Input
                id="vault-reset-passphrase-confirm"
                type="password"
                value={confirmNewPassphrase}
                onChange={e => setConfirmNewPassphrase(e.target.value)}
              />
            </div>
            <div className="text-xs text-warmgray-600">
              Mindestens 12 Zeichen. Das neue Passwort ersetzt Ihr bisheriges Tresor-Passwort.
            </div>
            <Button
              type="button"
              variant="link"
              className="px-0"
              onClick={() => setRecoveryIntent('unlock')}
            >
              Nur mit Wiederherstellungsschlussel entsperren
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="link"
            className="px-0"
            onClick={() => setRecoveryIntent('reset')}
          >
            Passwort mit Wiederherstellungsschlussel zurucksetzen
          </Button>
        )}
        <Button type="button" variant="link" className="px-0" onClick={() => setMode('passphrase')}>
          Passwort verwenden
        </Button>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <DialogFooter className="mt-6">
        <Button
          type="submit"
          disabled={isLoading || !recoveryKey || (recoveryIntent === 'reset' && !isResetValid)}
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {recoveryIntent === 'reset' ? 'Passwort zurucksetzen' : 'Entsperren'}
        </Button>
      </DialogFooter>
    </form>
  )
}

type VaultUnlockModalComponent = (({ onClose }: { onClose: () => void }) => ReactElement) & {
  Passphrase: typeof VaultUnlockPassphrase
  Recovery: typeof VaultUnlockRecovery
}

export const VaultUnlockModal: VaultUnlockModalComponent = function VaultUnlockModal({
  onClose,
}: {
  onClose: () => void
}) {
  const vault = useVault()
  const [mode, setMode] = useState<'passphrase' | 'recovery'>('passphrase')
  const [recoveryIntent, setRecoveryIntent] = useState<'unlock' | 'reset'>('unlock')
  const [passphrase, setPassphrase] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [newPassphrase, setNewPassphrase] = useState('')
  const [confirmNewPassphrase, setConfirmNewPassphrase] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleModeChange = (nextMode: 'passphrase' | 'recovery') => {
    setMode(nextMode)
    setError(null)
    if (nextMode === 'passphrase') {
      setRecoveryIntent('unlock')
      setRecoveryKey('')
      setNewPassphrase('')
      setConfirmNewPassphrase('')
    }
  }

  const handleUnlock = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (mode === 'recovery') {
        if (recoveryIntent === 'reset') {
          await vault.resetPassphraseWithRecovery(recoveryKey, newPassphrase)
        } else {
          await vault.unlockWithRecovery(recoveryKey)
        }
      } else {
        await vault.unlock(passphrase)
      }
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Entsperren')
    } finally {
      setIsLoading(false)
    }
  }

  const contextValue: VaultUnlockContextValue = {
    mode,
    setMode: handleModeChange,
    recoveryIntent,
    setRecoveryIntent,
    passphrase,
    setPassphrase,
    recoveryKey,
    setRecoveryKey,
    newPassphrase,
    setNewPassphrase,
    confirmNewPassphrase,
    setConfirmNewPassphrase,
    isLoading,
    error,
    handleUnlock,
    hasBiometricSetup: vault.hasBiometricSetup,
    isBiometricSupported: vault.isBiometricSupported,
    unlockWithBiometric: vault.unlockWithBiometric,
    onClose
  }

  return (
    <Dialog open={true} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🔒 Tresor entsperren</DialogTitle>
          <DialogDescription>
            Geben Sie Ihr Tresor-Passwort ein, um auf Ihre Dokumente zuzugreifen.
          </DialogDescription>
        </DialogHeader>

        <VaultUnlockContext.Provider value={contextValue}>
          {mode === 'passphrase' ? <VaultUnlockModal.Passphrase /> : <VaultUnlockModal.Recovery />}
        </VaultUnlockContext.Provider>
      </DialogContent>
    </Dialog>
  )
}

VaultUnlockModal.Passphrase = VaultUnlockPassphrase
VaultUnlockModal.Recovery = VaultUnlockRecovery
