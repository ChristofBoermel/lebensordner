'use client'

import { useState, useEffect, useRef } from 'react'
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
import { generateRecoveryKey } from '@/lib/security/document-e2ee'
import { useVault } from '@/lib/vault/VaultContext'

type Step = 1 | 2 | 3 | 4

export function VaultSetupModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const vault = useVault()
  const [step, setStep] = useState<Step>(1)
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [recoveryKeyHex, setRecoveryKeyHex] = useState('')
  const [savedChecked, setSavedChecked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const isTimedOutRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setPassphrase('')
      setConfirmPassphrase('')
      setRecoveryKeyHex('')
      setSavedChecked(false)
      setIsLoading(false)
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (step === 3) {
      generateRecoveryKey().then(setRecoveryKeyHex)
    }
  }, [step])

  useEffect(() => {
    if (step === 4) {
      isTimedOutRef.current = false
      setIsTimedOut(false)
      controllerRef.current?.abort()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      controllerRef.current = new AbortController()
      timerRef.current = setTimeout(() => {
        isTimedOutRef.current = true
        setIsTimedOut(true)
        controllerRef.current?.abort()
      }, 30000)
      setIsLoading(true)
      setError(null)
      ;(async () => {
        try {
          const controller = controllerRef.current
          if (!controller) return
          await vault.setup(passphrase, recoveryKeyHex, controller.signal)
          if (!isMountedRef.current) return
          if (timerRef.current) {
            clearTimeout(timerRef.current)
          }
          setIsLoading(false)
        } catch (err: any) {
          if (!isMountedRef.current) return
          if (err?.name === 'AbortError') {
            if (isTimedOutRef.current) {
              setIsLoading(false)
              return
            }
            onClose()
            return
          }
          setIsLoading(false)
          setError(err?.message || 'Fehler beim Einrichten des Tresors')
          setStep(2)
        }
      })()
    }
  }, [step, vault, passphrase, recoveryKeyHex])

  useEffect(() => {
    if (!isOpen) {
      controllerRef.current?.abort()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      controllerRef.current = null
      timerRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      controllerRef.current?.abort()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const classes = [
    /[a-z]/.test(passphrase),
    /[A-Z]/.test(passphrase),
    /[0-9]/.test(passphrase),
    /[^A-Za-z0-9]/.test(passphrase)
  ].filter(Boolean).length

  let strengthLabel = 'Schwach'
  let strengthPercent = 33
  let strengthColor = 'bg-red-500'

  if (passphrase.length >= 12 && classes >= 2) {
    strengthLabel = 'Mittel'
    strengthPercent = 66
    strengthColor = 'bg-amber-500'
  }

  if ((passphrase.length >= 12 && classes === 4) || (passphrase.length >= 16 && classes >= 3)) {
    strengthLabel = 'Stark'
    strengthPercent = 100
    strengthColor = 'bg-emerald-500'
  }

  const formattedRecoveryKey = recoveryKeyHex
    ? recoveryKeyHex.replace(/(.{8})/g, '$1 ').trim()
    : ''

  const handleRetry = async () => {
    isTimedOutRef.current = false
    setIsTimedOut(false)
    controllerRef.current?.abort()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    controllerRef.current = new AbortController()
    timerRef.current = setTimeout(() => {
      isTimedOutRef.current = true
      setIsTimedOut(true)
      controllerRef.current?.abort()
    }, 30000)
    setIsLoading(true)
    setError(null)
    try {
      const controller = controllerRef.current
      if (!controller) return
      await vault.setup(passphrase, recoveryKeyHex, controller.signal)
      if (!isMountedRef.current) return
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      setIsLoading(false)
    } catch (err: any) {
      if (!isMountedRef.current) return
      if (err?.name === 'AbortError') {
        if (isTimedOutRef.current) {
          setIsLoading(false)
          return
        }
        onClose()
        return
      }
      setIsLoading(false)
      setError(err?.message || 'Fehler beim Einrichten des Tresors')
      setStep(2)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map(i => {
            const isDone = i < step
            const isActive = i === step
            const base = 'h-1 flex-1 rounded-full'
            const color = isActive ? 'bg-emerald-500' : isDone ? 'bg-warmgray-300' : 'bg-warmgray-200'
            return <div key={i} className={`${base} ${color}`} />
          })}
        </div>

        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>🔐 Dokument-Tresor einrichten</DialogTitle>
              <DialogDescription>
                Ihre Dokumente werden Ende-zu-Ende verschlüsselt. Das bedeutet, dass nur Sie Zugriff haben.
                Wir speichern keine Entschlüsselungsschlüssel auf dem Server.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-md border border-warmgray-200 bg-warmgray-50 px-4 py-3 text-sm text-warmgray-700">
              Ihr Passwort verlässt niemals Ihr Gerät. Wir können es nicht zurücksetzen.
            </div>
            <DialogFooter className="mt-6">
              <Button onClick={() => setStep(2)}>Weiter</Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Passwort wählen</DialogTitle>
              <DialogDescription>
                Wählen Sie ein starkes Passwort, das Sie sich merken können.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="vault-passphrase">Passwort</Label>
                <Input
                  id="vault-passphrase"
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vault-passphrase-confirm">Passwort bestätigen</Label>
                <Input
                  id="vault-passphrase-confirm"
                  type="password"
                  value={confirmPassphrase}
                  onChange={e => setConfirmPassphrase(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-warmgray-600 mb-1">
                  <span>Passwortstärke</span>
                  <span>{strengthLabel}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-warmgray-100">
                  <div className={`h-2 rounded-full ${strengthColor}`} style={{ width: `${strengthPercent}%` }} />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                onClick={() => setStep(3)}
                disabled={passphrase.length < 12 || passphrase !== confirmPassphrase}
              >
                Weiter
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>Wiederherstellungsschlüssel</DialogTitle>
              <DialogDescription>
                Bewahren Sie diesen Schlüssel sicher auf, falls Sie Ihr Passwort vergessen.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              ⚠️ Dieser Schlüssel wird nur einmal angezeigt und nicht gespeichert.
            </div>
            <div className="mt-4 rounded-md border border-warmgray-200 bg-warmgray-50 px-4 py-3">
              {recoveryKeyHex ? (
                <code className="font-mono text-sm break-all">{formattedRecoveryKey}</code>
              ) : (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(recoveryKeyHex)}
                disabled={!recoveryKeyHex}
              >
                📋 Kopieren
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!recoveryKeyHex}>
                🖨️ Drucken
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                id="vault-key-saved"
                type="checkbox"
                checked={savedChecked}
                onChange={e => setSavedChecked(e.target.checked)}
              />
              <Label htmlFor="vault-key-saved">Ich habe den Schlüssel gespeichert</Label>
            </div>
            <DialogFooter className="mt-6">
              <Button
                onClick={() => setStep(4)}
                disabled={!savedChecked || !/^[0-9a-f]{64}$/i.test(recoveryKeyHex)}
              >
                Weiter
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 4 && (
          <>
            <DialogHeader>
              <DialogTitle>Einrichtung abschließen</DialogTitle>
              <DialogDescription>
                Wir richten Ihren Tresor ein und verschlüsseln die Schlüssel.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex items-center gap-3 text-sm text-warmgray-700">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Tresor wird eingerichtet...' : 'Tresor eingerichtet'}
            </div>
            {!isLoading && isTimedOut && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Die Verbindung hat zu lange gedauert. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.
              </div>
            )}
            {!isLoading && error && !isTimedOut && (
              <div className="mt-4 text-sm text-red-600">{error}</div>
            )}
            <DialogFooter className="mt-6">
              {isLoading && (
                <Button
                  variant="outline"
                  onClick={() => {
                    controllerRef.current?.abort()
                    onClose()
                  }}
                >
                  Abbrechen
                </Button>
              )}
              {!isLoading && isTimedOut && (
                <>
                  <Button variant="outline" onClick={onClose}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleRetry}>
                    Erneut versuchen
                  </Button>
                </>
              )}
              {!isLoading && !isTimedOut && !error && (
                <Button onClick={onClose}>
                  Schließen
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
