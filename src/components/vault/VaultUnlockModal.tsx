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
import { Loader2 } from 'lucide-react'
import { useVault } from '@/lib/vault/VaultContext'

type VaultUnlockContextValue = {
  mode: 'passphrase' | 'recovery'
  setMode: (mode: 'passphrase' | 'recovery') => void
  passphrase: string
  setPassphrase: (value: string) => void
  recoveryKey: string
  setRecoveryKey: (value: string) => void
  isLoading: boolean
  error: string | null
  handleUnlock: () => Promise<void>
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
  const { passphrase, setPassphrase, setMode, isLoading, error, handleUnlock } = useVaultUnlockContext()

  return (
    <>
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
        <Button variant="link" className="px-0" onClick={() => setMode('recovery')}>
          Wiederherstellungsschlussel verwenden
        </Button>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <DialogFooter className="mt-6">
        <Button onClick={handleUnlock} disabled={isLoading || !passphrase}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Entsperren
        </Button>
      </DialogFooter>
    </>
  )
}

function VaultUnlockRecovery() {
  const { recoveryKey, setRecoveryKey, setMode, isLoading, error, handleUnlock } = useVaultUnlockContext()

  return (
    <>
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
        <Button variant="link" className="px-0" onClick={() => setMode('passphrase')}>
          Passwort verwenden
        </Button>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <DialogFooter className="mt-6">
        <Button onClick={handleUnlock} disabled={isLoading || !recoveryKey}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Entsperren
        </Button>
      </DialogFooter>
    </>
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
  const [passphrase, setPassphrase] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUnlock = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (mode === 'recovery') {
        await vault.unlockWithRecovery(recoveryKey)
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
    setMode,
    passphrase,
    setPassphrase,
    recoveryKey,
    setRecoveryKey,
    isLoading,
    error,
    handleUnlock
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
