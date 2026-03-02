'use client'

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  deriveMasterKey,
  fromBase64,
  toBase64,
  unwrapKey,
  wrapKey,
} from '@/lib/security/document-e2ee'
import { VaultUnlockModal } from '@/components/vault/VaultUnlockModal'

interface VaultContextValue {
  isSetUp: boolean
  isUnlocked: boolean
  masterKey: CryptoKey | null
  isSetupRequested: boolean
  requestUnlock: () => void
  requestSetup: () => void
  closeSetup: () => void
  setup(passphrase: string, recoveryKeyHex: string, signal?: AbortSignal): Promise<void>
  unlock(passphrase: string): Promise<void>
  unlockWithRecovery(recoveryKeyHex: string): Promise<void>
  lock(): void
}

const VaultContext = createContext<VaultContextValue | null>(null)

const SESSION_PASSPHRASE_KEY = 'lo_v_p'

export function VaultProvider({ children }: { children: ReactNode }) {
  const [isSetUp, setIsSetUp] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null)
  const [isUnlockRequested, setIsUnlockRequested] = useState(false)
  const [isSetupRequested, setIsSetupRequested] = useState(false)

  const unlock = useCallback(async (passphrase: string) => {
    const response = await fetch('/api/vault/key-material')
    const data = await response.json()
    const { kdf_salt, kdf_params, wrapped_mk } = data || {}

    if (!kdf_salt) return; // Not set up

    const pdk = await deriveMasterKey(passphrase, fromBase64(kdf_salt), kdf_params)

    try {
      const mk = await unwrapKey(wrapped_mk, pdk, 'AES-KW')
      setMasterKey(mk)
      setIsUnlocked(true)
      // Save to session storage for caching
      try {
        sessionStorage.setItem(SESSION_PASSPHRASE_KEY, passphrase)
      } catch (e) {
        console.error('Failed to save to sessionStorage', e)
      }
    } catch {
      throw new Error('Falsches Passwort')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function checkSetupAndAutoUnlock() {
      try {
        const response = await fetch('/api/vault/key-material')
        if (!response.ok) {
          if (!cancelled) {
            setIsSetUp(false)
          }
          return
        }

        const data = await response.json()
        if (!cancelled) {
          setIsSetUp(data.exists === true)
          
          // Auto-unlock if passphrase is in session storage
          const cachedPassphrase = sessionStorage.getItem(SESSION_PASSPHRASE_KEY)
          if (cachedPassphrase && data.exists) {
            try {
              await unlock(cachedPassphrase)
            } catch (e) {
              console.error('Auto-unlock failed', e)
              sessionStorage.removeItem(SESSION_PASSPHRASE_KEY)
            }
          }
        }
      } catch {
        if (!cancelled) {
          setIsSetUp(false)
        }
      }
    }

    void checkSetupAndAutoUnlock()
    return () => {
      cancelled = true
    }
  }, [unlock])

  useEffect(() => {
    const clearCachedPassphrase = () => {
      try {
        sessionStorage.removeItem(SESSION_PASSPHRASE_KEY)
      } catch {
        // ignore sessionStorage failures on unload
      }
    }

    window.addEventListener('beforeunload', clearCachedPassphrase)
    window.addEventListener('pagehide', clearCachedPassphrase)

    return () => {
      window.removeEventListener('beforeunload', clearCachedPassphrase)
      window.removeEventListener('pagehide', clearCachedPassphrase)
    }
  }, [])

  const setup = useCallback(async (passphrase: string, recoveryKeyHex: string, signal?: AbortSignal) => {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const kdf_params = { iterations: 600000, hash: 'SHA-256' }
    const pdk = await deriveMasterKey(passphrase, salt, kdf_params)
    const mk = await globalThis.crypto.subtle.generateKey({ name: 'AES-KW', length: 256 }, true, [
      'wrapKey',
      'unwrapKey',
    ])
    const wrapped_mk = await wrapKey(mk, pdk)
    const recovery_key_salt = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const rdk = await deriveMasterKey(recoveryKeyHex, recovery_key_salt, kdf_params)
    const wrapped_mk_with_recovery = await wrapKey(mk, rdk)

    const response = await fetch('/api/vault/key-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        kdf_salt: toBase64(salt),
        kdf_params,
        wrapped_mk,
        wrapped_mk_with_recovery,
        recovery_key_salt: toBase64(recovery_key_salt),
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to store vault keys')
    }

    setMasterKey(mk)
    setIsSetUp(true)
    setIsUnlocked(true)
    setIsSetupRequested(false)
    sessionStorage.setItem(SESSION_PASSPHRASE_KEY, passphrase)
  }, [])

  const unlockWithRecovery = useCallback(async (recoveryKeyHex: string) => {
    const response = await fetch('/api/vault/key-material')
    const data = await response.json()
    const { wrapped_mk_with_recovery, kdf_params, recovery_key_salt } = data || {}

    const rdk = await deriveMasterKey(recoveryKeyHex, fromBase64(recovery_key_salt), kdf_params)

    try {
      const mk = await unwrapKey(wrapped_mk_with_recovery, rdk, 'AES-KW')
      setMasterKey(mk)
      setIsUnlocked(true)
    } catch {
      throw new Error('Falscher Wiederherstellungsschlüssel')
    }
  }, [])

  const lock = useCallback(() => {
    setMasterKey(null)
    setIsUnlocked(false)
    sessionStorage.removeItem(SESSION_PASSPHRASE_KEY)
  }, [])

  function requestUnlock() {
    setIsUnlockRequested(true)
  }

  function requestSetup() {
    setIsSetupRequested(true)
  }

  function closeSetup() {
    setIsSetupRequested(false)
  }

  useEffect(() => {
    if (isUnlocked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsUnlockRequested(false)
    }
  }, [isUnlocked])

  const value: VaultContextValue = {
    isSetUp,
    isUnlocked,
    masterKey,
    isSetupRequested,
    requestUnlock,
    requestSetup,
    closeSetup,
    setup,
    unlock,
    unlockWithRecovery,
    lock,
  }

  return (
    <VaultContext.Provider value={value}>
      {children}
      {isUnlockRequested ? <VaultUnlockModal onClose={() => setIsUnlockRequested(false)} /> : null}
    </VaultContext.Provider>
  )
}

export function useVault() {
  const context = use(VaultContext)
  if (!context) {
    throw new Error('useVault must be used within VaultProvider')
  }
  return context
}
