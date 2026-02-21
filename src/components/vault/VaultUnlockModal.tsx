'use client'

import { useState, useEffect } from 'react'
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

export function VaultUnlockModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const vault = useVault()
  const [passphrase, setPassphrase] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPassphrase('')
      setRecoveryKey('')
      setUseRecovery(false)
      setIsLoading(false)
      setError(null)
    }
  }, [isOpen])

  const handleUnlock = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (useRecovery) {
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

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🔒 Tresor entsperren</DialogTitle>
          <DialogDescription>
            Geben Sie Ihr Tresor-Passwort ein, um auf Ihre Dokumente zuzugreifen.
          </DialogDescription>
        </DialogHeader>

        {!useRecovery && (
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
            <Button variant="link" className="px-0" onClick={() => setUseRecovery(true)}>
              Wiederherstellungsschlüssel verwenden
            </Button>
          </div>
        )}

        {useRecovery && (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="vault-unlock-recovery">Wiederherstellungsschlüssel</Label>
              <Input
                id="vault-unlock-recovery"
                type="text"
                className="font-mono"
                value={recoveryKey}
                onChange={e => setRecoveryKey(e.target.value)}
              />
            </div>
            <Button variant="link" className="px-0" onClick={() => setUseRecovery(false)}>
              Passwort verwenden
            </Button>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

        <DialogFooter className="mt-6">
          <Button
            onClick={handleUnlock}
            disabled={isLoading || (!useRecovery && !passphrase) || (useRecovery && !recoveryKey)}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Entsperren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
