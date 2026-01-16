'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Shield, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'

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
  
  const router = useRouter()
  const supabase = createClient()
  const { capture, identify } = usePostHog()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
          error_type: 'login_failed',
          error_message: error.message,
        })
        
        // Check for email not confirmed error
        if (error.message.includes('Email not confirmed')) {
          setStep('email_not_confirmed')
          return
        }
        
        if (error.message === 'Invalid login credentials') {
          setError('E-Mail-Adresse oder Passwort ist falsch.')
        } else {
          setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
        }
        return
      }

      if (data.user) {
        // Check if email is confirmed
        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut()
          setStep('email_not_confirmed')
          return
        }

        // Check if user has 2FA enabled
        const { data: profile } = await supabase
          .from('profiles')
          .select('two_factor_enabled')
          .eq('id', data.user.id)
          .single()

        if (profile?.two_factor_enabled) {
          // User has 2FA - sign them out and request code
          await supabase.auth.signOut()
          setPendingUserId(data.user.id)
          setStep('2fa')
          setIsLoading(false)
          return
        }

        // No 2FA - proceed with login
        identify(data.user.id, { email: data.user.email })
        capture(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'email' })
        router.push('/dashboard')
        router.refresh()
      }
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

      // Code is valid - sign in again
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.')
        setStep('credentials')
        return
      }

      if (data.user) {
        identify(data.user.id, { email: data.user.email })
        capture(ANALYTICS_EVENTS.USER_SIGNED_IN, { method: 'email_2fa' })
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
              <li>• Prüfen Sie Ihren Spam-Ordner</li>
              <li>• Warten Sie einige Minuten</li>
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
          {error && (
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
              disabled={isLoading}
            />
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
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
