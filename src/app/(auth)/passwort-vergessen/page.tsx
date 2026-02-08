'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, Mail, CheckCircle2, Clock } from 'lucide-react'
import TurnstileWidget from '@/components/auth/turnstile'

export default function PasswordForgotPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Security states
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number>(0)

  // Countdown timer for rate limiting
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setRetryAfterSeconds(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      })

      const data = await response.json()

      if (response.status === 200 && data.success) {
        setIsSuccess(true)
        return
      }

      if (response.status === 429) {
        const seconds = data.retryAfterSeconds || 60
        setRetryAfterSeconds(seconds)
        setCountdown(seconds)
        setError(`Zu viele Anfragen. Bitte warten Sie ${seconds} Sekunden.`)
        return
      }

      if (response.status === 400 && data.requiresCaptcha) {
        setShowCaptcha(true)
        setError('Aus Sicherheitsgründen ist eine CAPTCHA-Verifizierung erforderlich.')
        return
      }

      if (response.status === 400 && data.error === 'Invalid CAPTCHA. Please try again.') {
        setError('CAPTCHA-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.')
        setTurnstileToken(null)
        setCaptchaKey(prev => prev + 1)
        return
      }

      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-sage-600" />
          </div>
          <CardTitle className="text-2xl">E-Mail gesendet</CardTitle>
          <CardDescription className="text-base">
            Wir haben Ihnen eine E-Mail an <strong>{email}</strong> gesendet.
            Klicken Sie auf den Link in der E-Mail, um Ihr Passwort zurückzusetzen.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-4">
          <Link href="/anmelden" className="w-full">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zur Anmeldung
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Passwort vergessen?</CardTitle>
        <CardDescription>
          Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Rate Limit Countdown */}
          {retryAfterSeconds !== null && countdown > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-start gap-3">
              <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Bitte warten</p>
                <p className="mt-1">
                  Zu viele Anfragen. Bitte warten Sie noch{' '}
                  <strong>{countdown} {countdown === 1 ? 'Sekunde' : 'Sekunden'}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* General Error */}
          {error && !(retryAfterSeconds !== null && countdown > 0) && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              placeholder="ihre@email.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {/* CAPTCHA Widget */}
          {showCaptcha && (
            <div className="space-y-2">
              <p className="text-sm text-warmgray-600 text-center">
                Aus Sicherheitsgründen ist eine CAPTCHA-Verifizierung erforderlich.
              </p>
              <TurnstileWidget key={captchaKey} onVerify={handleTurnstileVerify} />
              {turnstileToken && (
                <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Verifiziert
                </p>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || (countdown > 0) || (showCaptcha && !turnstileToken)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Senden...
              </>
            ) : (
              'Link senden'
            )}
          </Button>

          <Link href="/anmelden" className="text-sm text-sage-600 hover:text-sage-700">
            <ArrowLeft className="inline mr-1 h-4 w-4" />
            Zurück zur Anmeldung
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
