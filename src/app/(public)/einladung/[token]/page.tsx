'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, XCircle, Users, Shield, Leaf } from 'lucide-react'
import Link from 'next/link'

interface InvitationData {
  id: string
  name: string
  relationship: string
  access_level: string
  owner_name: string
  invitation_status: string
}

export default function InvitationPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [declined, setDeclined] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const { data, error } = await supabase
          .from('trusted_persons')
          .select(`
            id,
            name,
            relationship,
            access_level,
            invitation_status,
            profiles!trusted_persons_user_id_fkey (
              full_name
            )
          `)
          .eq('invitation_token', token)
          .single()

        if (error || !data) {
          setError('Diese Einladung ist ungültig oder abgelaufen.')
          return
        }

        if (data.invitation_status === 'accepted') {
          setAccepted(true)
        }

        setInvitation({
          id: data.id,
          name: data.name,
          relationship: data.relationship,
          access_level: data.access_level,
          owner_name: (data.profiles as any)?.full_name || 'Unbekannt',
          invitation_status: data.invitation_status,
        })
      } catch (err) {
        setError('Ein Fehler ist aufgetreten.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvitation()
  }, [token, supabase])

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('trusted_persons')
        .update({
          invitation_status: 'accepted',
          invitation_accepted_at: new Date().toISOString(),
        })
        .eq('invitation_token', token)

      if (error) throw error
      setAccepted(true)
    } catch (err) {
      setError('Fehler beim Akzeptieren der Einladung.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async () => {
    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('trusted_persons')
        .update({
          invitation_status: 'declined',
        })
        .eq('invitation_token', token)

      if (error) throw error
      setDeclined(true)
    } catch (err) {
      setError('Fehler beim Ablehnen der Einladung.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
          <Leaf className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-semibold text-warmgray-900">Lebensordner</span>
      </Link>

      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          {error ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
                Ungültige Einladung
              </h2>
              <p className="text-warmgray-600">{error}</p>
            </div>
          ) : accepted ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
                Einladung angenommen!
              </h2>
              <p className="text-warmgray-600 mb-6">
                Sie sind jetzt als Vertrauensperson für {invitation?.owner_name} eingetragen.
              </p>
              <Button asChild>
                <Link href="/registrieren">Konto erstellen</Link>
              </Button>
            </div>
          ) : declined ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-warmgray-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-warmgray-600" />
              </div>
              <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
                Einladung abgelehnt
              </h2>
              <p className="text-warmgray-600">
                Sie haben die Einladung abgelehnt.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-sage-600" />
                </div>
                <h2 className="text-xl font-semibold text-warmgray-900 mb-2">
                  Einladung als Vertrauensperson
                </h2>
                <p className="text-warmgray-600">
                  <strong>{invitation?.owner_name}</strong> möchte Sie als Vertrauensperson hinzufügen.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-sage-50 border border-sage-200">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-sage-600" />
                  <span className="font-medium text-warmgray-900">Was bedeutet das?</span>
                </div>
                <ul className="text-sm text-warmgray-600 space-y-2">
                  <li>• Sie werden als "{invitation?.relationship}" eingetragen</li>
                  <li>• Zugriffslevel: {invitation?.access_level === 'immediate' ? 'Sofort' : invitation?.access_level === 'emergency' ? 'Im Notfall' : 'Nach Bestätigung'}</li>
                  <li>• Sie können im Notfall auf wichtige Dokumente zugreifen</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleAccept} 
                  className="flex-1"
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Annehmen
                </Button>
                <Button 
                  onClick={handleDecline} 
                  variant="outline"
                  className="flex-1"
                  disabled={isProcessing}
                >
                  Ablehnen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
