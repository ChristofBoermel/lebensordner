'use client'

import { useEffect } from 'react'
import { VaultSetup, VaultSetupModal } from '@/components/vault/VaultSetupModal'
import { VaultProvider, useVault } from '@/lib/vault/VaultContext'
import { InactivityLogout } from '@/components/auth/inactivity-logout'
import { VaultIdleLock } from '@/components/vault/VaultIdleLock'

function VaultSetupModalHost() {
  const { isSetupRequested, closeSetup } = useVault()

  if (!isSetupRequested) {
    return null
  }

  return (
    <VaultSetupModal isOpen={isSetupRequested} onClose={closeSetup} key={isSetupRequested ? 'open' : 'closed'}>
      <VaultSetup.Intro />
      <VaultSetup.Passphrase />
      <VaultSetup.RecoveryKey />
      <VaultSetup.Confirm />
      <VaultSetup.Success />
    </VaultSetupModal>
  )
}

export function VaultClientWrapper({ children }: { children: React.ReactNode }) {
  // allowed: I/O - run idempotent trusted-person account-link repair after dashboard auth session is active
  useEffect(() => {
    void fetch('/api/trusted-person/link', { method: 'POST' })
  }, [])

  return (
    <VaultProvider>
      <InactivityLogout />
      <VaultIdleLock />
      {children}
      <VaultSetupModalHost />
    </VaultProvider>
  )
}
