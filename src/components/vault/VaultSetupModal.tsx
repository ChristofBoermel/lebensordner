'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { generateRecoveryKey } from '@/lib/security/document-e2ee'
import { useVault } from '@/lib/vault/VaultContext'
import { VaultSetupContext, type Step } from './vault-setup/context'
import {
  VaultSetupConfirm,
  VaultSetupIntro,
  VaultSetupPassphrase,
  VaultSetupRecoveryKey,
} from './vault-setup'

export function VaultSetupModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}) {
  const vault = useVault()
  const [step, setStep] = useState<Step>(1)
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [recoveryKeyHex, setRecoveryKeyHex] = useState('')
  const [savedChecked, setSavedChecked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingRecoveryKey, setIsGeneratingRecoveryKey] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const isTimedOutRef = useRef(false)
  const recoveryKeyPromiseRef = useRef<Promise<string> | null>(null)
  const setupPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      controllerRef.current?.abort()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = null
      controllerRef.current = null
      recoveryKeyPromiseRef.current = null
      setupPromiseRef.current = null
    }
  }, [])

  const cleanupSetupState = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = null
    controllerRef.current = null
  }, [])

  const runSetup = useCallback(() => {
    if (setupPromiseRef.current) {
      return setupPromiseRef.current
    }

    const setupPromise = (async () => {
      isTimedOutRef.current = false
      setIsTimedOut(false)
      setError(null)
      setIsLoading(true)

      controllerRef.current?.abort()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      const controller = new AbortController()
      controllerRef.current = controller
      timerRef.current = setTimeout(() => {
        isTimedOutRef.current = true
        setIsTimedOut(true)
        controller.abort()
      }, 30000)

      try {
        await vault.setup(passphrase, recoveryKeyHex, controller.signal)

        if (!isMountedRef.current) {
          return
        }

        cleanupSetupState()
        setIsLoading(false)
      } catch (err: any) {
        if (!isMountedRef.current) {
          return
        }

        cleanupSetupState()

        if (err?.name === 'AbortError') {
          if (isTimedOutRef.current) {
            setIsLoading(false)
            return
          }

          setIsLoading(false)
          onClose()
          return
        }

        setIsLoading(false)
        setError(err?.message || 'Fehler beim Einrichten des Tresors')
        setStep(2)
      }
    })()

    setupPromiseRef.current = setupPromise.finally(() => {
      setupPromiseRef.current = null
    })

    return setupPromiseRef.current
  }, [cleanupSetupState, onClose, passphrase, recoveryKeyHex, vault])

  const generateRecoveryKeyOnce = useCallback(() => {
    if (/^[0-9a-f]{64}$/i.test(recoveryKeyHex)) {
      return Promise.resolve(recoveryKeyHex)
    }

    if (recoveryKeyPromiseRef.current) {
      return recoveryKeyPromiseRef.current
    }

    setIsGeneratingRecoveryKey(true)

    const promise = generateRecoveryKey()
      .then((hex) => {
        if (isMountedRef.current) {
          setRecoveryKeyHex(hex)
        }
        return hex
      })
      .finally(() => {
        recoveryKeyPromiseRef.current = null
        if (isMountedRef.current) {
          setIsGeneratingRecoveryKey(false)
        }
      })

    recoveryKeyPromiseRef.current = promise
    return promise
  }, [recoveryKeyHex])

  const goToRecoveryKeyStep = useCallback(() => {
    setStep(3)
    setSavedChecked(false)
    void generateRecoveryKeyOnce()
  }, [generateRecoveryKeyOnce])

  const startSetup = useCallback(() => {
    setStep(4)
    void runSetup()
  }, [runSetup])

  const retrySetup = useCallback(() => {
    void runSetup()
  }, [runSetup])

  const cancelSetup = useCallback(() => {
    controllerRef.current?.abort()
    onClose()
  }, [onClose])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      controllerRef.current?.abort()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = null
      controllerRef.current = null
      onClose()
    }
  }

  return (
    <VaultSetupContext
      value={{
        step,
        setStep,
        passphrase,
        setPassphrase,
        confirmPassphrase,
        setConfirmPassphrase,
        recoveryKeyHex,
        savedChecked,
        setSavedChecked,
        isLoading,
        isTimedOut,
        error,
        isGeneratingRecoveryKey,
        goToRecoveryKeyStep,
        startSetup,
        retrySetup,
        cancelSetup,
        controllerRef,
        timerRef,
        isMountedRef,
        isTimedOutRef,
        onClose,
      }}
    >
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4].map((item) => {
              const isDone = item < step
              const isActive = item === step
              const base = 'h-1 flex-1 rounded-full'
              const color = isActive ? 'bg-emerald-500' : isDone ? 'bg-warmgray-300' : 'bg-warmgray-200'
              return <div key={item} className={`${base} ${color}`} />
            })}
          </div>
          {children}
        </DialogContent>
      </Dialog>
    </VaultSetupContext>
  )
}

export const VaultSetup = {
  Intro: VaultSetupIntro,
  Passphrase: VaultSetupPassphrase,
  RecoveryKey: VaultSetupRecoveryKey,
  Confirm: VaultSetupConfirm,
}
