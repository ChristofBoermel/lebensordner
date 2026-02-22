'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  deriveMasterKey,
  wrapKey,
  unwrapKey,
  toBase64,
  fromBase64
} from '@/lib/security/document-e2ee'

interface VaultContextValue {
  isSetUp: boolean
  isUnlocked: boolean
  masterKey: CryptoKey | null
  setup(passphrase: string, recoveryKeyHex: string, signal?: AbortSignal): Promise<void>
  unlock(passphrase: string): Promise<void>
  unlockWithRecovery(recoveryKeyHex: string): Promise<void>
  lock(): void
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [isSetUp, setIsSetUp] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkSetup() {
      try {
        const res = await fetch('/api/vault/key-material')
        if (!res.ok) {
          if (!cancelled) {
            setIsSetUp(false)
          }
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setIsSetUp(data.exists === true)
        }
      } catch {
        if (!cancelled) {
          setIsSetUp(false)
        }
      }
    }

    checkSetup()
    return () => {
      cancelled = true
    }
  }, [])

  const setup = useCallback(async (passphrase: string, recoveryKeyHex: string, signal?: AbortSignal) => {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const kdf_params = { iterations: 600000, hash: 'SHA-256' }
    const pdk = await deriveMasterKey(passphrase, salt, kdf_params)
    const mk = await globalThis.crypto.subtle.generateKey({ name: 'AES-KW', length: 256 }, true, [
      'wrapKey',
      'unwrapKey'
    ])
    const wrapped_mk = await wrapKey(mk, pdk)
    const recovery_key_salt = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const rdk = await deriveMasterKey(recoveryKeyHex, recovery_key_salt, kdf_params)
    const wrapped_mk_with_recovery = await wrapKey(mk, rdk)

    const res = await fetch('/api/vault/key-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        kdf_salt: toBase64(salt),
        kdf_params,
        wrapped_mk,
        wrapped_mk_with_recovery,
        recovery_key_salt: toBase64(recovery_key_salt)
      })
    })

    if (!res.ok) {
      throw new Error('Failed to store vault keys')
    }

    setMasterKey(mk)
    setIsSetUp(true)
    setIsUnlocked(true)
  }, [])

  const unlock = useCallback(async (passphrase: string) => {
    const res = await fetch('/api/vault/key-material')
    const data = await res.json()
    const { kdf_salt, kdf_params, wrapped_mk } = data || {}

    const pdk = await deriveMasterKey(passphrase, fromBase64(kdf_salt), kdf_params)

    try {
      const mk = await unwrapKey(wrapped_mk, pdk, 'AES-KW')
      setMasterKey(mk)
      setIsUnlocked(true)
    } catch {
      throw new Error('Falsches Passwort')
    }
  }, [])

  const unlockWithRecovery = useCallback(async (recoveryKeyHex: string) => {
    const res = await fetch('/api/vault/key-material')
    const data = await res.json()
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
  }, [])

  const value: VaultContextValue = {
    isSetUp,
    isUnlocked,
    masterKey,
    setup,
    unlock,
    unlockWithRecovery,
    lock
  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) {
    throw new Error('useVault must be used within VaultProvider')
  }
  return ctx
}
