'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { capture } = usePostHog()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
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

      setIsSuccess(true)
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
            <CheckCircle2 className="w-8 h-8 text-sage-600" />
          </div>
          <CardTitle className="text-2xl">Fast geschafft!</CardTitle>
          <CardDescription className="text-base">
            Wir haben Ihnen eine E-Mail an <strong>{email}</strong> gesendet. 
            Bitte klicken Sie auf den Link in der E-Mail, um Ihr Konto zu bestätigen.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-4">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => router.push('/anmelden')}
          >
            Zur Anmeldung
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
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
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mindestens 8 Zeichen"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Passwort wiederholen"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <p className="text-sm text-warmgray-500">
            Mit der Registrierung stimmen Sie unseren{' '}
            <Link href="/agb" className="text-sage-600 hover:text-sage-700">
              Nutzungsbedingungen
            </Link>{' '}
            und der{' '}
            <Link href="/datenschutz" className="text-sage-600 hover:text-sage-700">
              Datenschutzerklärung
            </Link>{' '}
            zu.
          </p>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
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
