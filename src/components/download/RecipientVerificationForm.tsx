'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Lock } from 'lucide-react'

interface RecipientVerificationFormProps {
  token: string
  onVerified: () => void
}

export function RecipientVerificationForm({
  token,
  onVerified,
}: RecipientVerificationFormProps) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // allowed: imperative-sync - focus error region for screen readers on update
  const errorRef = useRef<HTMLDivElement | null>(null)

  // allowed: imperative-sync - focus error region when error appears
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  async function handleSubmit() {
    if (!email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/download-link/${token}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: email }),
      })
      const data = await res.json()
      if (res.status === 429) {
        setError('Zu viele Versuche. Bitte versuchen Sie es später erneut.')
      } else if (!res.ok) {
        setError(data.error || 'Verifizierung fehlgeschlagen')
      } else {
        onVerified()
      }
    } catch {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
          Empfänger-Verifizierung erforderlich
        </h3>
        <p className="text-warmgray-600 text-sm">
          Bitte geben Sie die E-Mail-Adresse ein, an die der Link gesendet wurde.
        </p>
      </div>
      <label htmlFor="recipient-email" className="sr-only">
        Empfänger-E-Mail
      </label>
      <div className="flex gap-2">
        <Input
          id="recipient-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Empfänger-E-Mail"
          aria-describedby={error ? 'verification-error' : undefined}
          autoComplete="email"
        />
        <Button
          onClick={handleSubmit}
          disabled={submitting || !email.trim()}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Prüfen'
          )}
        </Button>
      </div>
      {error && (
        <div
          id="verification-error"
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          {error}
        </div>
      )}
    </div>
  )
}
