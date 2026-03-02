'use client'

import { createContext, use, type MutableRefObject } from 'react'

export type Step = 1 | 2 | 3 | 4 | 5

export interface VaultSetupContextValue {
  step: Step
  setStep: (step: Step) => void
  passphrase: string
  setPassphrase: (value: string) => void
  confirmPassphrase: string
  setConfirmPassphrase: (value: string) => void
  recoveryKeyHex: string
  savedChecked: boolean
  setSavedChecked: (value: boolean) => void
  isLoading: boolean
  isTimedOut: boolean
  error: string | null
  isGeneratingRecoveryKey: boolean
  goToRecoveryKeyStep: () => void
  startSetup: () => void
  retrySetup: () => void
  cancelSetup: () => void
  controllerRef: MutableRefObject<AbortController | null>
  timerRef: MutableRefObject<NodeJS.Timeout | null>
  isMountedRef: MutableRefObject<boolean>
  isTimedOutRef: MutableRefObject<boolean>
  onClose: () => void
}

export const VaultSetupContext = createContext<VaultSetupContextValue | null>(null)

export function useVaultSetupContext() {
  const context = use(VaultSetupContext)
  if (!context) {
    throw new Error('VaultSetup compound components must be used within VaultSetupModal')
  }
  return context
}
