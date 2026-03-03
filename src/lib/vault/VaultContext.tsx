'use client'

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  deriveMasterKey,
  fromBase64,
  toBase64,
  unwrapKey,
  wrapKey,
} from '@/lib/security/document-e2ee'
import { createClient } from '@/lib/supabase/client'
import { EVENT_VAULT_UNLOCKED_BIOMETRIC } from '@/lib/security/audit-log'
import { VaultUnlockModal } from '@/components/vault/VaultUnlockModal'

interface VaultContextValue {
  isSetUp: boolean
  isUnlocked: boolean
  isUnlockRequested: boolean
  masterKey: CryptoKey | null
  lastUnlockTimestamp: number
  hasBiometricSetup: boolean
  isBiometricSupported: boolean
  isSetupRequested: boolean
  requestUnlock: () => void
  requestSetup: () => void
  closeSetup: () => void
  refreshBiometricStatus: () => Promise<void>
  setup(passphrase: string, recoveryKeyHex: string, signal?: AbortSignal): Promise<void>
  unlock(passphrase: string): Promise<void>
  unlockWithRecovery(recoveryKeyHex: string): Promise<void>
  setupBiometric(): Promise<void>
  unlockWithBiometric(): Promise<void>
  lock(): void
}

export const VaultContext = createContext<VaultContextValue | null>(null)

const SESSION_PASSPHRASE_KEY = 'lo_v_p'

export function VaultProvider({ children }: { children: ReactNode }) {
  const [isSetUp, setIsSetUp] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null)
  const [lastUnlockTimestamp, setLastUnlockTimestamp] = useState<number>(0)
  const [hasBiometricSetup, setHasBiometricSetup] = useState<boolean>(false)
  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isUnlockRequested, setIsUnlockRequested] = useState(false)
  const [isSetupRequested, setIsSetupRequested] = useState(false)
  const [supabase] = useState(() => createClient())

  async function refreshBiometricStatus() {
    try {
      const response = await fetch('/api/vault/key-material')
      if (!response.ok) {
        setHasBiometricSetup(false)
        return
      }
      const data = await response.json()
      setHasBiometricSetup(Boolean(data?.webauthn_credential_id))
    } catch {
      setHasBiometricSetup(false)
    }
  }

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
      setLastUnlockTimestamp(Date.now())
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
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled) {
          setUserId(user?.id ?? null)
          setUserEmail(user?.email ?? null)
        }

        const response = await fetch('/api/vault/key-material')
        if (!response.ok) {
          if (!cancelled) {
            setIsSetUp(false)
            setHasBiometricSetup(false)
          }
          return
        }

        const data = await response.json()
        if (!cancelled) {
          setIsSetUp(data.exists === true)
          setHasBiometricSetup(Boolean(data.webauthn_credential_id))
          
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
          setHasBiometricSetup(false)
        }
      }
    }

    void checkSetupAndAutoUnlock()
    return () => {
      cancelled = true
    }
  }, [supabase, unlock])

  useEffect(() => {
    let mounted = true
    void (async () => {
      if (
        typeof window === 'undefined' ||
        typeof PublicKeyCredential === 'undefined' ||
        !window.isSecureContext ||
        !navigator.credentials
      ) {
        if (mounted) {
          setIsBiometricSupported(false)
        }
        return
      }

      const capabilityResolver = (
        PublicKeyCredential as typeof PublicKeyCredential & {
          getClientCapabilities?: () => Promise<Record<string, unknown>>
        }
      ).getClientCapabilities

      if (typeof capabilityResolver !== 'function') {
        if (mounted) {
          setIsBiometricSupported(false)
        }
        return
      }

      let supported = false
      try {
        const capabilities = await capabilityResolver()
        supported = Boolean(capabilities?.prf)
      } catch {
        supported = false
      }

      if (mounted) {
        setIsBiometricSupported(supported)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

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
    setLastUnlockTimestamp(Date.now())
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
      setLastUnlockTimestamp(Date.now())
    } catch {
      throw new Error('Falscher Wiederherstellungsschlüssel')
    }
  }, [])

  async function setupBiometric() {
    if (!masterKey) {
      throw new Error('Vault must be unlocked to set up biometrics')
    }
    if (!isBiometricSupported || !navigator.credentials) {
      throw new Error('WebAuthn PRF not supported in this browser')
    }
    if (!userId) {
      throw new Error('Benutzer nicht gefunden')
    }

    const rpId = window.location.hostname
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userIdBytes = new TextEncoder().encode(userId)
    const prfEvalInput = new Uint8Array(32).fill(1)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { id: rpId, name: 'Lebensordner' },
        user: {
          id: userIdBytes,
          name: userEmail ?? userId,
          displayName: userEmail ?? userId,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        extensions: {
          prf: {
            eval: { first: prfEvalInput },
          },
        },
      },
    } as CredentialCreationOptions)) as PublicKeyCredential | null

    if (!credential) {
      throw new Error('WebAuthn-Erstellung fehlgeschlagen')
    }

    const extensionResults = credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
      prf?: { results?: { first?: ArrayBuffer } }
    }
    const prfResult = extensionResults?.prf?.results?.first
    if (!prfResult) {
      throw new Error('WebAuthn PRF not supported in this browser')
    }

    const prfWrappingKey = await crypto.subtle.importKey('raw', prfResult, 'AES-KW', false, ['wrapKey'])
    const wrappedMkBytes = await crypto.subtle.wrapKey('raw', masterKey, prfWrappingKey, { name: 'AES-KW' })

    const response = await fetch('/api/vault/biometric-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wrapped_mk_with_biometric: toBase64(new Uint8Array(wrappedMkBytes)),
        webauthn_credential_id: toBase64(new Uint8Array(credential.rawId)),
        webauthn_rp_id: rpId,
      }),
    })

    if (!response.ok) {
      throw new Error('Fehler beim Speichern der biometrischen Daten')
    }

    setHasBiometricSetup(true)
  }

  async function unlockWithBiometric() {
    if (!hasBiometricSetup) {
      throw new Error('Kein biometrisches Setup vorhanden')
    }
    if (!isBiometricSupported || !navigator.credentials) {
      throw new Error('WebAuthn PRF not supported or denied')
    }

    const response = await fetch('/api/vault/biometric-key')
    if (!response.ok) {
      throw new Error('Biometrischer Schlüssel nicht gefunden')
    }

    const data = await response.json()
    const { webauthn_credential_id, wrapped_mk_with_biometric } = data || {}
    if (!webauthn_credential_id || !wrapped_mk_with_biometric) {
      throw new Error('Biometrischer Schlüssel unvollständig')
    }

    const credentialIdBytes = fromBase64(webauthn_credential_id)
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const prfEvalInput = new Uint8Array(32).fill(1)

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: credentialIdBytes }],
        extensions: {
          prf: {
            eval: { first: prfEvalInput },
          },
        },
      },
    } as CredentialRequestOptions)) as PublicKeyCredential | null

    if (!assertion) {
      throw new Error('Biometrische Authentifizierung fehlgeschlagen')
    }

    const extensionResults = assertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
      prf?: { results?: { first?: ArrayBuffer } }
    }
    const prfResult = extensionResults?.prf?.results?.first
    if (!prfResult) {
      throw new Error('WebAuthn PRF not supported or denied')
    }

    const prfUnwrappingKey = await crypto.subtle.importKey('raw', prfResult, 'AES-KW', false, ['unwrapKey'])
    const wrappedMkBytes = fromBase64(wrapped_mk_with_biometric)
    const mk = await crypto.subtle.unwrapKey(
      'raw',
      wrappedMkBytes,
      prfUnwrappingKey,
      { name: 'AES-KW' },
      { name: 'AES-KW', length: 256 },
      true,
      ['wrapKey', 'unwrapKey']
    )

    setMasterKey(mk)
    setIsUnlocked(true)
    setLastUnlockTimestamp(Date.now())

    const credentialIdTruncated = String(webauthn_credential_id).slice(0, 8)

    try {
      await fetch('/api/documents/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: EVENT_VAULT_UNLOCKED_BIOMETRIC,
          event_data: {
            credential_id_truncated: credentialIdTruncated,
          },
        }),
      })
    } catch {
      // ignore audit failures so unlock state is not blocked
    }
  }

  const lock = useCallback(() => {
    setMasterKey(null)
    setIsUnlocked(false)
    setLastUnlockTimestamp(0)
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
    isUnlockRequested,
    masterKey,
    lastUnlockTimestamp,
    hasBiometricSetup,
    isBiometricSupported,
    isSetupRequested,
    requestUnlock,
    requestSetup,
    closeSetup,
    refreshBiometricStatus,
    setup,
    unlock,
    unlockWithRecovery,
    setupBiometric,
    unlockWithBiometric,
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
