'use client'

import { VaultProvider } from '@/lib/vault/VaultContext'

export function VaultClientWrapper({ children }: { children: React.ReactNode }) {
  return <VaultProvider>{children}</VaultProvider>
}
