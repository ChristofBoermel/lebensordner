'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Shield, ArrowLeft, Mail, CheckCircle2, ShieldAlert, Clock } from 'lucide-react'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'
import TurnstileWidget from '@/components/auth/turnstile'

type LoginStep = 'credentials' | '2fa' | 'email_not_confirmed'

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState(false)

  // Security states
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [failureCount, setFailureCount] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number>(0)

  const router = useRouter()
  const supabase = createClient()
  const { capture, identify } = usePostHog()

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      })

      const data = await response.json()

      if (response.status === 200 && data.success) {
        // Hydrate the browser Supabase client with session tokens
        if (data.access_token && data.refresh_token) {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          })
        }

        // Successful login - now check for 2FA
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // Check if email is confirmed
          if (!user.email_confirmed_at) {
            await supabase.auth.signOut()
            setStep('email_not_confirmed')
            return
          }

          // Check if user has 2FA enabled
          const { data: profile } = await supabase
            .from('profiles')
            .select('two_factor_enabled')
            .eq('id', user.id)
            .single()

          if (profile?.two_factor_enabled) {
            await supabase.auth.signOut()
            setPendingUserId(user.id)
            setStep('2fa')
            setIsLoading(false)
            return
          }

          // No 2FA - proceed
          identify(user.id, { email: user.email })
          capture(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'email' })

          // Sync consent cookie to server ledger (non-blocking)
          try {
            await fetch('/api/consent/sync', { method: 'POST' })
          } catch {
            // Consent sync failure must not block login
          }

          router.push('/dashboard')
          router.refresh()
        }
        return
      }

      // Handle error responses
      if (response.status === 429) {
        // Rate limited
        const seconds = data.retryAfterSeconds || 60
        setRetryAfterSeconds(seconds)
        setCountdown(seconds)
        setError(`Zu viele Anfragen. Bitte warten Sie ${seconds} Sekunden.`)
        capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
          error_type: 'rate_limited',
        })
        return
      }

      if (response.status === 403) {
        // Account locked
        setIsLocked(true)
        setError(null)
        capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
          error_type: 'account_locked',
        })
        return
      }

      if (response.status === 400 && data.requiresCaptcha) {
        // CAPTCHA required
        setShowCaptcha(true)
        setFailureCount(data.failureCount || 3)
        setError('Aus Sicherheitsgriinden ist eine CAPTCHA-Verifizierung erforderlich.')
        return
      }

      if (response.status === 400 && data.error === 'Invalid CAPTCHA. Please try again.') {
        setError('CAPTCHA-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.')
        setTurnstileToken(null)
        return
      }

      if (response.status === 401) {
        // Invalid credentials
        const newFailureCount = data.failureCount || failureCount + 1
        setFailureCount(newFailureCount)

        if (data.requiresCaptcha) {
          setShowCaptcha(true)
        }

        capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
          error_type: 'login_failed',
          error_message: data.error,
        })

        if (newFailureCount < 3) {
          const remaining = 3 - newFailureCount
          setError(`E-Mail-Adresse oder Passwort ist falsch. ${remaining === 1 ? 'Noch 1 Versuch' : `Noch ${remaining} Versuche`} vor CAPTCHA-Verifizierung.`)
        } else {
          setError('E-Mail-Adresse oder Passwort ist falsch.')
        }
        return
      }

      // Generic error
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setIsLoading(true)
    setError(null)
    setResendSuccess(false)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) {
        setError('Fehler beim Senden der E-Mail. Bitte versuchen Sie es später erneut.')
        return
      }

      setResendSuccess(true)
    } catch (err) {
      setError('Ein Fehler ist aufgetreten.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()

    if (twoFactorCode.length !== 6) {
      setError('Bitte geben Sie einen 6-stelligen Code ein.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Verify the 2FA code
      const verifyResponse = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUserId,
          token: twoFactorCode
        }),
      })

      const verifyData = await verifyResponse.json()

      if (!verifyResponse.ok) {
        setError(verifyData.error || 'Ungültiger Code')
        setIsLoading(false)
        return
      }

      // Code is valid - sign in again via server endpoint
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const loginData = await loginResponse.json()

      if (!loginResponse.ok || !loginData.success) {
        setError('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.')
        setStep('credentials')
        return
      }

      // Hydrate the browser Supabase client with session tokens
      if (loginData.access_token && loginData.refresh_token) {
        await supabase.auth.setSession({
          access_token: loginData.access_token,
          refresh_token: loginData.refresh_token,
        })
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        identify(user.id, { email: user.email })
        capture(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'email_2fa' })

        // Sync consent cookie to server ledger (non-blocking)
        try {
          await fetch('/api/consent/sync', { method: 'POST' })
        } catch {
          // Consent sync failure must not block login
        }

        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    } finally {
      setIsLoading(false)
    }
  }

  const goBack = () => {
    setStep('credentials')
    setTwoFactorCode('')
    setError(null)
    setPendingUserId(null)
    setResendSuccess(false)
  }

  // Email Not Confirmed Screen
  if (step === 'email_not_confirmed') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">E-Mail nicht bestätigt</CardTitle>
          <CardDescription>
            Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse, um sich anmelden zu können.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {resendSuccess && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">E-Mail gesendet!</p>
                <p>Wir haben Ihnen eine neue Bestätigungs-E-Mail an <strong>{email}</strong> gesendet.</p>
              </div>
            </div>
          )}

          <p className="text-sm text-warmgray-600 text-center">
            Wir haben eine Bestätigungs-E-Mail an <strong>{email}</strong> gesendet.
            Klicken Sie auf den Link in der E-Mail, um Ihr Konto zu aktivieren.
          </p>

          <div className="text-sm text-warmgray-500 text-center">
            <p>Keine E-Mail erhalten?</p>
            <ul className="mt-2 space-y-1">
              <li>Prüfen Sie Ihren Spam-Ordner</li>
              <li>Warten Sie einige Minuten</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            onClick={handleResendConfirmation}
            className="w-full"
            disabled={isLoading || resendSuccess}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Senden...
              </>
            ) : resendSuccess ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                E-Mail gesendet
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Bestätigungs-E-Mail erneut senden
              </>
            )}
          </Button>

          <Button type="button" variant="ghost" onClick={goBack} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Anmeldung
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // 2FA Code Input Screen
  if (step === '2fa') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-sage-600" />
          </div>
          <CardTitle className="text-2xl">Zwei-Faktor-Authentifizierung</CardTitle>
          <CardDescription>
            Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleVerify2FA}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="2fa-code">Bestätigungscode</Label>
              <Input
                id="2fa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
                disabled={isLoading}
              />
            </div>

            <p className="text-xs text-warmgray-500 text-center">
              Öffnen Sie Ihre Authenticator-App (z.B. Google Authenticator) und geben Sie den angezeigten Code ein.
            </p>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading || twoFactorCode.length !== 6}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Überprüfen...
                </>
              ) : (
                'Anmelden'
              )}
            </Button>

            <Button type="button" variant="ghost" onClick={goBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zur Anmeldung
            </Button>
          </CardFooter>
        </form>
      </Card>
    )
  }

  // Normal Login Screen
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Willkommen zurück</CardTitle>
        <CardDescription>
          Melden Sie sich an, um auf Ihren Lebensordner zuzugreifen
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {/* Account Locked Banner */}
          {isLocked && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Konto gesperrt</p>
                <p className="mt-1">
                  Ihr Konto wurde nach mehreren fehlgeschlagenen Anmeldeversuchen gesperrt.
                  Bitte{' '}
                  <Link href="/passwort-vergessen" className="underline font-medium hover:text-red-800">
                    setzen Sie Ihr Passwort zurück
                  </Link>
                  , um Ihr Konto zu entsperren.
                </p>
              </div>
            </div>
          )}

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
          {error && !isLocked && (
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
              disabled={isLoading || isLocked}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Passwort</Label>
              <Link
                href="/passwort-vergessen"
                className="text-sm text-sage-600 hover:text-sage-700"
              >
                Passwort vergessen?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading || isLocked}
            />
          </div>

          {/* CAPTCHA Widget */}
          {showCaptcha && (
            <div className="space-y-2">
              <p className="text-sm text-warmgray-600 text-center">
                Aus Sicherheitsgründen ist eine CAPTCHA-Verifizierung erforderlich.
              </p>
              <TurnstileWidget onVerify={handleTurnstileVerify} />
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
            disabled={isLoading || isLocked || (countdown > 0) || (showCaptcha && !turnstileToken)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Anmelden...
              </>
            ) : (
              'Anmelden'
            )}
          </Button>

          <p className="text-sm text-warmgray-600 text-center">
            Noch kein Konto?{' '}
            <Link href="/registrieren" className="text-sage-600 hover:text-sage-700 font-medium">
              Jetzt registrieren
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
