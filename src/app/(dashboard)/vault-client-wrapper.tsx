'use client'

import { VaultSetup, VaultSetupModal } from '@/components/vault/VaultSetupModal'
import { VaultProvider, useVault } from '@/lib/vault/VaultContext'
import { InactivityLogout } from '@/components/auth/inactivity-logout'

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
  return (
    <VaultProvider>
      <InactivityLogout />
      {children}
      <VaultSetupModalHost />
    </VaultProvider>
  )
}
