'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type PendingState = {
  status: 'setup_required' | 'wrong_account' | 'expired_invitation' | 'revoked'
  ownerName?: string
  expectedEmail?: string
  invitationExpiresAt?: string
  otpVerified?: boolean
}

function RedeemPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status')
  const token = searchParams.get('token')
  const [pendingState, setPendingState] = useState<PendingState | null>(null)
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  // allowed: I/O - load pending secure-access redemption state from the server
  useEffect(() => {
    if (token) {
      window.location.replace(`/api/trusted-access/invitations/redeem?token=${encodeURIComponent(token)}`)
      return
    }

    async function loadPendingState() {
      if (initialStatus === 'expired' || initialStatus === 'revoked' || initialStatus === 'wrong_account') {
        setPendingState({
          status:
            initialStatus === 'wrong_account'
              ? 'wrong_account'
              : initialStatus === 'revoked'
                ? 'revoked'
                : 'expired_invitation',
        })
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/trusted-access/invitations/pending')
        const data = await response.json()
        if (!response.ok) {
          setPendingState({
            status: data.status === 'wrong_account' ? 'wrong_account' : 'expired_invitation',
          })
          return
        }
        setPendingState(data)
      } catch {
        setError('Der sichere Zugriff konnte nicht geladen werden.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadPendingState()
  }, [initialStatus, token])

  async function handleSendOtp() {
    setIsSendingOtp(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/trusted-access/invitations/otp/send', {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Code konnte nicht gesendet werden.')
      }
      setMessage('Wir haben einen Code an Ihre E-Mail-Adresse gesendet.')
    } catch (sendError: any) {
      setError(sendError?.message || 'Code konnte nicht gesendet werden.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  async function handleVerifyOtp() {
    setIsVerifyingOtp(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/trusted-access/invitations/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Code konnte nicht bestaetigt werden.')
      }
      setPendingState((current) => (current ? { ...current, otpVerified: true } : current))
      setMessage('Code bestaetigt. Dieses Geraet kann jetzt eingerichtet werden.')
    } catch (verifyError: any) {
      setError(verifyError?.message || 'Code konnte nicht bestaetigt werden.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  async function handleComplete() {
    setIsCompleting(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/trusted-access/invitations/complete', {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Geraet konnte nicht eingerichtet werden.')
      }

      window.localStorage.setItem(`rk_${data.ownerId}`, data.relationshipKey)
      setMessage('Dieses Geraet ist jetzt eingerichtet. Sie werden weitergeleitet.')
      window.setTimeout(() => {
        router.push(data.redirectTo || `/vp-dashboard/view/${data.ownerId}`)
      }, 1200)
    } catch (completeError: any) {
      setError(completeError?.message || 'Geraet konnte nicht eingerichtet werden.')
    } finally {
      setIsCompleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-slate-700 shadow-sm">
          Sicherer Zugriff wird vorbereitet...
        </div>
      </div>
    )
  }

  if (pendingState?.status === 'wrong_account') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm space-y-3">
          <p className="font-semibold">Dieser Link ist fuer ein anderes Konto bestimmt.</p>
          <p className="text-sm">
            Bitte melden Sie sich mit der eingeladenen E-Mail-Adresse an.
            {pendingState.expectedEmail ? ` Erwartet wird ${pendingState.expectedEmail}.` : ''}
          </p>
          <Button onClick={() => router.push('/anmelden')}>Zur Anmeldung</Button>
        </div>
      </div>
    )
  }

  if (pendingState?.status === 'expired_invitation' || pendingState?.status === 'revoked') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
          {pendingState.status === 'revoked'
            ? 'Dieser sichere Zugriffslink wurde widerrufen. Bitte fordern Sie einen neuen Link an.'
            : 'Dieser sichere Zugriffslink ist abgelaufen. Bitte bitten Sie den Besitzer um einen neuen Link.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Sicherer Dokumentenzugang</h1>
          <p className="text-sm text-slate-600">
            {pendingState?.ownerName
              ? `${pendingState.ownerName} hat diesen Browser fuer freigegebene Dokumente eingeladen.`
              : 'Dieser Browser wird fuer freigegebene Dokumente eingerichtet.'}
          </p>
          {pendingState?.expectedEmail && (
            <p className="text-sm text-slate-600">
              Verwenden Sie dieselbe E-Mail-Adresse: <strong>{pendingState.expectedEmail}</strong>
            </p>
          )}
          {pendingState?.invitationExpiresAt && (
            <p className="text-xs text-slate-500">
              Link gueltig bis {new Date(pendingState.invitationExpiresAt).toLocaleDateString('de-DE')}{' '}
              {new Date(pendingState.invitationExpiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
          <p>1. Fordern Sie den Code fuer den sicheren Zugriff an.</p>
          <p>2. Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein.</p>
          <p>3. Richten Sie diesen Browser einmalig ein.</p>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={handleSendOtp} disabled={isSendingOtp || isCompleting} className="w-full">
            {isSendingOtp ? 'Code wird gesendet...' : 'Code per E-Mail senden'}
          </Button>

          <Input
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="6-stelliger Code"
            maxLength={6}
          />

          <Button
            variant="outline"
            onClick={handleVerifyOtp}
            disabled={otp.length !== 6 || isVerifyingOtp || isCompleting}
            className="w-full"
          >
            {isVerifyingOtp ? 'Code wird geprueft...' : 'Code bestaetigen'}
          </Button>

          <Button
            onClick={handleComplete}
            disabled={!pendingState?.otpVerified || isCompleting}
            className="w-full"
          >
            {isCompleting ? 'Browser wird eingerichtet...' : 'Diesen Browser einrichten'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function RedeemPage() {
  return (
    <Suspense fallback={<div className="p-8">Laden...</div>}>
      <RedeemPageInner />
    </Suspense>
  )
}
