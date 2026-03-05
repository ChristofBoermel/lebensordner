'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, Mail, Eye, EyeOff } from 'lucide-react'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'
import { PasswordStrength } from '@/components/auth/password-strength'

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const invitedEmail = searchParams.get('email')
  const isInvited = searchParams.get('invited') === 'true'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(invitedEmail ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [tosAccepted, setTosAccepted] = useState(false)
  const [tosError, setTosError] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { capture } = usePostHog()

  // allowed: subscription lifecycle - poll auth session while waiting for email confirmation
  useEffect(() => {
    if (!isSuccess || isCheckingSession) return
    const intervalId = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setIsCheckingSession(true)
      router.push('/onboarding')
    }, 3000)
    return () => clearInterval(intervalId)
  }, [isSuccess, isCheckingSession, router, supabase])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!tosAccepted) {
      setTosError(true)
      setIsLoading(false)
      return
    }

    // Validation
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.')
      setIsLoading(false)
      return
    }

    // Validate email matches invited email
    if (isInvited && invitedEmail && email.toLowerCase() !== invitedEmail.toLowerCase()) {
      setError('Bitte verwenden Sie die E-Mail-Adresse aus Ihrer Einladung.')
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
          error_type: 'registration_failed',
          error_message: error.message,
        })
        if (error.message.includes('already registered')) {
          setError('Diese E-Mail-Adresse ist bereits registriert.')
        } else {
          setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
        }
        return
      }

      // Track successful registration
      capture(ANALYTICS_EVENTS.USER_SIGNED_UP, {
        method: 'email',
        has_name: !!fullName,
      })

      // Handle auto-confirmed accounts (if email confirmation is disabled)
      if (data.session) {
        router.push('/onboarding')
        return
      }

      setIsSuccess(true)
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card key="success" className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
            {isCheckingSession ? (
              <Loader2 className="w-8 h-8 text-sage-600 animate-spin" />
            ) : (
              <Mail className="w-8 h-8 text-sage-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isCheckingSession ? 'Bestätigung erkannt!' : 'Fast geschafft!'}
          </CardTitle>
          <CardDescription className="text-base">
            {isCheckingSession ? (
              'Sie werden weitergeleitet...'
            ) : (
              <>
                Wir haben Ihnen eine E-Mail an <strong>{email}</strong> gesendet.
                <br /><br />
                <span className="text-sage-700 font-medium">
                  Klicken Sie auf den Link in der E-Mail – Sie werden automatisch angemeldet.
                </span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {!isCheckingSession && (
            <div className="p-4 rounded-lg bg-cream-50 border border-cream-200 text-sm text-warmgray-600">
              <p className="mb-2">
                <strong>Tipp:</strong> Prüfen Sie auch Ihren Spam-Ordner.
              </p>
              <p className="text-warmgray-500">
                Nach dem Klick auf den Bestätigungslink werden Sie automatisch eingeloggt und zur Einrichtung weitergeleitet.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          {!isCheckingSession && (
            <p className="text-sm text-warmgray-500 text-center">
              Bereits bestätigt?{' '}
              <Link href="/onboarding" className="text-sage-600 hover:text-sage-700 font-medium">
                Weiter zur Einrichtung
              </Link>
            </p>
          )}
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card key="register" className="w-full max-w-md animate-fade-in">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Konto erstellen</CardTitle>
        <CardDescription>
          30 Tage kostenlos testen – keine Kreditkarte erforderlich
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="fullName">Vollständiger Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Max Mustermann"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              placeholder="ihre@email.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || isInvited}
              className={isInvited ? 'bg-warmgray-50' : ''}
            />
            {isInvited && (
              <p className="text-xs text-sage-600">
                Diese E-Mail-Adresse stammt aus Ihrer Einladung.
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mindestens 8 Zeichen"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warmgray-400 hover:text-warmgray-600 focus:outline-none"
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Passwort wiederholen"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warmgray-400 hover:text-warmgray-600 focus:outline-none"
                aria-label={showConfirmPassword ? 'Bestätigung verbergen' : 'Bestätigung anzeigen'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-red-600">Die Passwörter stimmen nicht überein.</p>
            )}
          </div>

          <div className="flex items-start gap-3 mt-2">
            <input
              type="checkbox"
              id="tos-checkbox"
              checked={tosAccepted}
              onChange={(e) => {
                setTosAccepted(e.target.checked)
                setTosError(false)
              }}
              className="w-4 h-4 mt-0.5 flex-shrink-0 rounded border border-warmgray-400 accent-sage-600"
              disabled={isLoading}
            />
            <label htmlFor="tos-checkbox" className="text-sm text-warmgray-600 leading-relaxed">
              Ich akzeptiere die{' '}
              <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-sage-600 hover:text-sage-700 underline">
                Nutzungsbedingungen
              </a>{' '}
              und die{' '}
              <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-sage-600 hover:text-sage-700 underline">
                Datenschutzerklärung
              </a>
            </label>
          </div>
          {tosError && (
            <p className="text-sm text-red-600 mt-1">
              Bitte akzeptieren Sie die Nutzungsbedingungen um fortzufahren.
            </p>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading || !tosAccepted}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Konto wird erstellt...
              </>
            ) : (
              'Kostenlos registrieren'
            )}
          </Button>
          
          <p className="text-sm text-warmgray-600 text-center">
            Bereits ein Konto?{' '}
            <Link href="/anmelden" className="text-sage-600 hover:text-sage-700 font-medium">
              Jetzt anmelden
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
