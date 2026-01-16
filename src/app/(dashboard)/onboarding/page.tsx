'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  User, Phone, MapPin, Calendar, Heart, Users, FileText,
  ArrowRight, ArrowLeft, Check, Loader2, Sparkles, Shield,
  Upload, UserPlus, HeartPulse
} from 'lucide-react'

type Step = 'welcome' | 'profile' | 'emergency' | 'trusted' | 'documents' | 'complete'

const STEPS: { id: Step; title: string; description: string }[] = [
  { id: 'welcome', title: 'Willkommen', description: 'Einführung in Lebensordner' },
  { id: 'profile', title: 'Ihr Profil', description: 'Persönliche Daten' },
  { id: 'emergency', title: 'Notfall-Kontakt', description: 'Erster Ansprechpartner' },
  { id: 'trusted', title: 'Vertrauensperson', description: 'Zugriff im Notfall' },
  { id: 'documents', title: 'Erstes Dokument', description: 'Dokument hochladen' },
  { id: 'complete', title: 'Fertig!', description: 'Einrichtung abgeschlossen' },
]

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Form states
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    date_of_birth: '',
    address: '',
  })

  const [emergencyForm, setEmergencyForm] = useState({
    name: '',
    phone: '',
    relationship: '',
  })

  const [trustedForm, setTrustedForm] = useState({
    name: '',
    email: '',
    relationship: '',
  })

  const [skipSteps, setSkipSteps] = useState({
    emergency: false,
    trusted: false,
    documents: false,
  })

  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/anmelden')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, full_name, phone, date_of_birth, address')
        .eq('id', user.id)
        .single()

      if (profile?.onboarding_completed) {
        router.push('/dashboard')
        return
      }

      // Pre-fill profile form if data exists
      if (profile) {
        setProfileForm({
          full_name: profile.full_name || '',
          phone: profile.phone || '',
          date_of_birth: profile.date_of_birth || '',
          address: profile.address || '',
        })
      }
    }

    checkOnboarding()
  }, [supabase, router])

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)
  const progress = ((currentStepIndex) / (STEPS.length - 1)) * 100

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const saveProfile = async () => {
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      await supabase.from('profiles').update({
        full_name: profileForm.full_name || null,
        phone: profileForm.phone || null,
        date_of_birth: profileForm.date_of_birth || null,
        address: profileForm.address || null,
      }).eq('id', user.id)

      goToNextStep()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const saveEmergencyContact = async () => {
    if (skipSteps.emergency) {
      goToNextStep()
      return
    }

    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      await supabase.from('emergency_contacts').insert({
        user_id: user.id,
        name: emergencyForm.name,
        phone: emergencyForm.phone,
        relationship: emergencyForm.relationship,
        is_primary: true,
      })

      goToNextStep()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const saveTrustedPerson = async () => {
    if (skipSteps.trusted) {
      goToNextStep()
      return
    }

    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      await supabase.from('trusted_persons').insert({
        user_id: user.id,
        name: trustedForm.name,
        email: trustedForm.email,
        relationship: trustedForm.relationship,
        access_level: 'emergency',
        access_delay_hours: 48,
      })

      goToNextStep()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const completeOnboarding = async () => {
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      await supabase.from('profiles').update({
        onboarding_completed: true,
      }).eq('id', user.id)

      router.push('/dashboard')
    } catch (err) {
      console.error('Complete error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-sage-100 flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-sage-600" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-2">
                Willkommen bei Lebensordner Digital
              </h2>
              <p className="text-warmgray-600 max-w-md mx-auto">
                In wenigen Schritten richten wir gemeinsam Ihren persönlichen Lebensordner ein. 
                So haben Sie alle wichtigen Unterlagen an einem sicheren Ort.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200">
                <Shield className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                <p className="font-medium text-warmgray-900">Sicher</p>
                <p className="text-sm text-warmgray-500">Ende-zu-Ende verschlüsselt</p>
              </div>
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200">
                <FileText className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                <p className="font-medium text-warmgray-900">Organisiert</p>
                <p className="text-sm text-warmgray-500">Alle Dokumente strukturiert</p>
              </div>
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200">
                <Users className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                <p className="font-medium text-warmgray-900">Vorgesorgt</p>
                <p className="text-sm text-warmgray-500">Familie informiert</p>
              </div>
            </div>

            <Button onClick={goToNextStep} size="lg" className="mt-6">
              Einrichtung starten
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )

      case 'profile':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-sage-600" />
              </div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-2">
                Ihre persönlichen Daten
              </h2>
              <p className="text-warmgray-600">
                Diese Informationen helfen im Notfall bei der Identifikation.
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="full_name">Vollständiger Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
                  <Input
                    id="full_name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Max Mustermann"
                    className="pl-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefonnummer</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+49 123 456789"
                    className="pl-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Geburtsdatum</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={profileForm.date_of_birth}
                    onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                    className="pl-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-5 h-5 text-warmgray-400" />
                  <textarea
                    id="address"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Musterstraße 1&#10;12345 Musterstadt"
                    className="w-full min-h-[80px] rounded-md border-2 border-warmgray-200 bg-white pl-12 pr-4 py-3 text-base transition-colors placeholder:text-warmgray-400 focus-visible:outline-none focus-visible:border-sage-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={goToPrevStep}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Zurück
              </Button>
              <Button onClick={saveProfile} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                Weiter
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )

      case 'emergency':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
                <HeartPulse className="w-8 h-8 text-sage-600" />
              </div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-2">
                Ihr erster Notfall-Kontakt
              </h2>
              <p className="text-warmgray-600">
                Wer soll im Notfall als erstes kontaktiert werden?
              </p>
            </div>

            {!skipSteps.emergency ? (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="emergency_name">Name *</Label>
                  <Input
                    id="emergency_name"
                    value={emergencyForm.name}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, name: e.target.value })}
                    placeholder="Name der Person"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_phone">Telefonnummer *</Label>
                  <Input
                    id="emergency_phone"
                    type="tel"
                    value={emergencyForm.phone}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, phone: e.target.value })}
                    placeholder="+49 123 456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_relationship">Beziehung *</Label>
                  <Input
                    id="emergency_relationship"
                    value={emergencyForm.relationship}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, relationship: e.target.value })}
                    placeholder="z.B. Ehepartner, Sohn, Tochter"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSkipSteps({ ...skipSteps, emergency: true })}
                  className="text-sm text-warmgray-500 hover:text-warmgray-700 underline"
                >
                  Später hinzufügen
                </button>
              </div>
            ) : (
              <div className="text-center py-8 max-w-md mx-auto">
                <p className="text-warmgray-600 mb-4">
                  Sie können Notfall-Kontakte später unter "Notfall & Vorsorge" hinzufügen.
                </p>
                <button
                  type="button"
                  onClick={() => setSkipSteps({ ...skipSteps, emergency: false })}
                  className="text-sage-600 hover:text-sage-700 underline"
                >
                  Doch jetzt hinzufügen
                </button>
              </div>
            )}

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={goToPrevStep}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Zurück
              </Button>
              <Button 
                onClick={saveEmergencyContact} 
                disabled={isSaving || (!skipSteps.emergency && (!emergencyForm.name || !emergencyForm.phone || !emergencyForm.relationship))}
              >
                {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                Weiter
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )

      case 'trusted':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-sage-600" />
              </div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-2">
                Eine Vertrauensperson hinzufügen
              </h2>
              <p className="text-warmgray-600">
                Diese Person kann im Notfall auf Ihre Dokumente zugreifen.
              </p>
            </div>

            {!skipSteps.trusted ? (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="trusted_name">Name *</Label>
                  <Input
                    id="trusted_name"
                    value={trustedForm.name}
                    onChange={(e) => setTrustedForm({ ...trustedForm, name: e.target.value })}
                    placeholder="Name der Person"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trusted_email">E-Mail-Adresse *</Label>
                  <Input
                    id="trusted_email"
                    type="email"
                    value={trustedForm.email}
                    onChange={(e) => setTrustedForm({ ...trustedForm, email: e.target.value })}
                    placeholder="email@beispiel.de"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trusted_relationship">Beziehung *</Label>
                  <Input
                    id="trusted_relationship"
                    value={trustedForm.relationship}
                    onChange={(e) => setTrustedForm({ ...trustedForm, relationship: e.target.value })}
                    placeholder="z.B. Sohn, Tochter, Ehepartner"
                  />
                </div>

                <div className="p-4 rounded-lg bg-sage-50 border border-sage-200">
                  <p className="text-sm text-warmgray-600">
                    <strong>Zugriffsart:</strong> Notfall-Zugriff mit 48 Stunden Wartezeit. 
                    Sie können dies später anpassen.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSkipSteps({ ...skipSteps, trusted: true })}
                  className="text-sm text-warmgray-500 hover:text-warmgray-700 underline"
                >
                  Später hinzufügen
                </button>
              </div>
            ) : (
              <div className="text-center py-8 max-w-md mx-auto">
                <p className="text-warmgray-600 mb-4">
                  Sie können Vertrauenspersonen später unter "Zugriff & Familie" hinzufügen.
                </p>
                <button
                  type="button"
                  onClick={() => setSkipSteps({ ...skipSteps, trusted: false })}
                  className="text-sage-600 hover:text-sage-700 underline"
                >
                  Doch jetzt hinzufügen
                </button>
              </div>
            )}

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={goToPrevStep}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Zurück
              </Button>
              <Button 
                onClick={saveTrustedPerson} 
                disabled={isSaving || (!skipSteps.trusted && (!trustedForm.name || !trustedForm.email || !trustedForm.relationship))}
              >
                {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                Weiter
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )

      case 'documents':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-sage-600" />
              </div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-2">
                Ihr erstes Dokument
              </h2>
              <p className="text-warmgray-600">
                Laden Sie ein wichtiges Dokument hoch – z.B. Ihren Personalausweis.
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="border-2 border-dashed border-warmgray-300 rounded-lg p-8 text-center hover:border-sage-400 transition-colors cursor-pointer"
                onClick={() => router.push('/dokumente?upload=true')}
              >
                <Upload className="w-12 h-12 text-warmgray-400 mx-auto mb-4" />
                <p className="font-medium text-warmgray-900 mb-1">Dokument hochladen</p>
                <p className="text-sm text-warmgray-500">Klicken Sie hier, um zur Dokumenten-Seite zu gelangen</p>
              </div>

              <button
                type="button"
                onClick={goToNextStep}
                className="mt-4 text-sm text-warmgray-500 hover:text-warmgray-700 underline block mx-auto"
              >
                Später hochladen
              </button>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={goToPrevStep}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Zurück
              </Button>
              <Button onClick={goToNextStep}>
                Weiter
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-sage-100 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-sage-600" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-2">
                Geschafft! 🎉
              </h2>
              <p className="text-warmgray-600 max-w-md mx-auto">
                Ihr Lebensordner ist eingerichtet. Sie können jetzt weitere Dokumente 
                hochladen, Erinnerungen erstellen und Ihre Informationen vervollständigen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto mt-8">
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200 text-left">
                <FileText className="w-6 h-6 text-sage-600 mb-2" />
                <p className="font-medium text-warmgray-900">Dokumente</p>
                <p className="text-sm text-warmgray-500">Laden Sie weitere wichtige Unterlagen hoch</p>
              </div>
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200 text-left">
                <Heart className="w-6 h-6 text-sage-600 mb-2" />
                <p className="font-medium text-warmgray-900">Notfall-Infos</p>
                <p className="text-sm text-warmgray-500">Ergänzen Sie medizinische Daten</p>
              </div>
            </div>

            <Button onClick={completeOnboarding} size="lg" className="mt-6" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
              Zum Dashboard
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-warmgray-500 mb-2">
            <span>Schritt {currentStepIndex + 1} von {STEPS.length}</span>
            <span>{STEPS[currentStepIndex].title}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="pt-8 pb-8">
            {renderStep()}
          </CardContent>
        </Card>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStepIndex
                  ? 'bg-sage-600'
                  : index < currentStepIndex
                  ? 'bg-sage-300'
                  : 'bg-warmgray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
