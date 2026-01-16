'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'

export default function PasswordForgotPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/passwort-reset`,
      })

      if (error) {
        setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
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
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
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
