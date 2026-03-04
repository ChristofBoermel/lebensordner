'use client'

import { useState, useEffect } from 'react'
import { Fingerprint, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const DISMISSED_KEY = 'passkey_nudge_dismissed'

export function PasskeyNudge() {
  const [visible, setVisible] = useState(false)

  // allowed: I/O + imperative-sync - check platform support and localStorage
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return

    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((supported) => {
          if (!supported) return
          // Show nudge after a short delay so it doesn't flash on mount
          timer = setTimeout(() => setVisible(true), 1500)
        })
        .catch(() => {})
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-4 animate-fade-in">
      <div className="bg-sage-950 text-white rounded-xl shadow-xl px-5 py-4 flex items-start gap-4">
        <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-sage-700 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white">Schneller anmelden</p>
          <p className="text-xs text-sage-300 mt-0.5 leading-relaxed">
            Nutzen Sie Face ID oder Fingerabdruck — kein Passwort nötig.
          </p>
          <div className="flex gap-2 mt-3">
            <Link href="/einstellungen?tab=sicherheit#biometrie">
              <Button
                size="sm"
                className="bg-sage-600 hover:bg-sage-500 text-white text-xs h-7 px-3"
                onClick={dismiss}
              >
                Einrichten
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="text-sage-400 hover:text-white hover:bg-sage-800 text-xs h-7 px-3"
              onClick={dismiss}
            >
              Nicht jetzt
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-sage-500 hover:text-white mt-0.5 focus:outline-none"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
