'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  User, Phone, MapPin, FileText,
  ArrowRight, ArrowLeft, Check, Loader2, Sparkles, Shield,
  Upload, HeartPulse, Wallet, Home, Landmark,
  Users, Briefcase, Church, FolderOpen, Smartphone, X
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'

type Step = 'welcome' | 'profile' | 'documents' | 'emergency' | 'complete'

const STEPS: { id: Step; title: string; description: string }[] = [
  { id: 'welcome', title: 'Willkommen', description: 'Einführung in Lebensordner' },
  { id: 'profile', title: 'Ihr Profil', description: 'Persönliche Daten' },
  { id: 'documents', title: 'Dokumente', description: 'Übersicht der Kategorien' },
  { id: 'emergency', title: 'Notfall-Kontakt', description: 'Erster Ansprechpartner' },
  { id: 'complete', title: 'Fertig!', description: 'Einrichtung abgeschlossen' },
]

const STORAGE_KEY = 'onboarding_progress'

interface OnboardingProgress {
  currentStep: Step
  profileForm: {
    full_name: string
    phone: string
    date_of_birth: string
    address: string
  }
  emergencyForm: {
    name: string
    phone: string
    relationship: string
  }
  skippedEmergency: boolean
  welcomeNote: string
}

function getDefaultProgress(): OnboardingProgress {
  return {
    currentStep: 'welcome',
    profileForm: {
      full_name: '',
      phone: '',
      date_of_birth: '',
      address: '',
    },
    emergencyForm: {
      name: '',
      phone: '',
      relationship: '',
    },
    skippedEmergency: false,
    welcomeNote: '',
  }
}

function loadProgress(): OnboardingProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

function saveProgress(progress: OnboardingProgress) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Ignore storage errors
  }
}

function clearProgress() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [savedProgress, setSavedProgress] = useState<OnboardingProgress | null>(null)
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

  const [skippedEmergency, setSkippedEmergency] = useState(false)
  const [welcomeNote, setWelcomeNote] = useState('')
  const [showQrCode, setShowQrCode] = useState(false)

  // Auto-save progress
  const autoSave = useCallback(() => {
    const progress: OnboardingProgress = {
      currentStep,
      profileForm,
      emergencyForm,
      skippedEmergency,
      welcomeNote,
    }
    saveProgress(progress)
  }, [currentStep, profileForm, emergencyForm, skippedEmergency, welcomeNote])

  // Auto-save on changes (debounced effect)
  useEffect(() => {
    if (isInitializing) return
    const timer = setTimeout(autoSave, 500)
    return () => clearTimeout(timer)
  }, [autoSave, isInitializing])

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/anmelden')
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed, full_name, phone, date_of_birth, address')
          .eq('id', user.id)
          .single()

        // If profile exists and onboarding is completed, go to dashboard
        if (profile?.onboarding_completed) {
          clearProgress()
          router.replace('/dashboard')
          return
        }

        // If no profile exists, try to create one via API
        if (error || !profile) {
          console.log('No profile found, creating via API...')
          try {
            await fetch('/api/profile/ensure', { method: 'POST' })
          } catch (e) {
            console.error('Failed to ensure profile:', e)
          }
        }

        // Check for saved progress
        const saved = loadProgress()
        if (saved && saved.currentStep !== 'welcome') {
          // User has progress - show resume dialog
          setSavedProgress(saved)
          setShowResumeDialog(true)
        }

        // Pre-fill profile form if data exists in database
        if (profile) {
          setProfileForm(prev => ({
            full_name: profile.full_name || prev.full_name || '',
            phone: profile.phone || prev.phone || '',
            date_of_birth: profile.date_of_birth || prev.date_of_birth || '',
            address: profile.address || prev.address || '',
          }))
        }
      } finally {
        setIsInitializing(false)
      }
    }

    checkOnboarding()
  }, [supabase, router])

  const resumeProgress = () => {
    if (savedProgress) {
      setCurrentStep(savedProgress.currentStep)
      setProfileForm(savedProgress.profileForm)
      setEmergencyForm(savedProgress.emergencyForm)
      setSkippedEmergency(savedProgress.skippedEmergency)
      setWelcomeNote(savedProgress.welcomeNote)
    }
    setShowResumeDialog(false)
  }

  const startFresh = () => {
    clearProgress()
    setCurrentStep('welcome')
    setProfileForm(getDefaultProgress().profileForm)
    setEmergencyForm(getDefaultProgress().emergencyForm)
    setSkippedEmergency(false)
    setWelcomeNote('')
    setShowResumeDialog(false)
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

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

  const skipStep = () => {
    // Can skip any step except welcome (step 1)
    if (currentStep !== 'welcome') {
      if (currentStep === 'emergency') {
        setSkippedEmergency(true)
      }
      goToNextStep()
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
    if (skippedEmergency) {
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

  const completeOnboarding = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        console.error('API returned error:', data.error)
        throw new Error(data.error || 'Fehler beim Abschließen')
      }

      // Clear saved progress on successful completion
      clearProgress()

      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      console.error('Complete error:', err)
      const message = err instanceof Error ? err.message : 'Bitte versuchen Sie es erneut.'
      alert('Fehler beim Speichern: ' + message)
    } finally {
      setIsSaving(false)
    }
  }

  const postponeOnboarding = () => {
    // Save current progress and go to dashboard
    autoSave()
    router.push('/dashboard')
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

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Button onClick={goToNextStep} size="lg">
                In Ruhe beginnen
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={postponeOnboarding}
              >
                Später weiterlesen
              </Button>
            </div>
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
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-500" />
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
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-500" />
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
                <Input
                  id="date_of_birth"
                  type="date"
                  value={profileForm.date_of_birth}
                  onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-5 h-5 text-warmgray-500" />
                  <textarea
                    id="address"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Musterstraße 1&#10;12345 Musterstadt"
                    className="w-full min-h-[80px] rounded-md border-2 border-warmgray-400 bg-white pl-12 pr-4 py-3 text-base text-gray-900 transition-colors placeholder:text-warmgray-500 focus-visible:outline-none focus-visible:border-sage-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={goToPrevStep}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={skipStep}
                  className="text-warmgray-500"
                >
                  Überspringen
                </Button>
                <Button onClick={saveProfile} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                  Weiter
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )

      case 'documents':
        const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
          user: User,
          wallet: Wallet,
          shield: Shield,
          home: Home,
          'heart-pulse': HeartPulse,
          'file-text': FileText,
          landmark: Landmark,
          users: Users,
          briefcase: Briefcase,
          church: Church,
          folder: FolderOpen,
        }
        const highlightedCategories: DocumentCategory[] = ['identitaet', 'versicherungen', 'finanzen', 'gesundheit', 'vertraege', 'rente']

        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-sage-600" />
              </div>
              <h2 className="text-2xl font-serif font-semibold text-warmgray-900 mb-2">
                Ihre Dokumente organisieren
              </h2>
              <p className="text-warmgray-600">
                Nach der Einrichtung können Sie Dokumente in diese Kategorien sortieren:
              </p>
            </div>

            <div className="max-w-lg mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {highlightedCategories.map((catKey) => {
                  const cat = DOCUMENT_CATEGORIES[catKey]
                  const IconComponent = categoryIcons[cat.icon] || FileText
                  return (
                    <div
                      key={catKey}
                      className="p-4 rounded-lg bg-cream-50 border border-cream-200 text-center"
                    >
                      <IconComponent className="w-8 h-8 text-sage-600 mx-auto mb-2" />
                      <p className="font-medium text-warmgray-900 text-sm">{cat.name}</p>
                      <p className="text-xs text-warmgray-500 mt-1 truncate">
                        {cat.examples[0]}
                      </p>
                    </div>
                  )
                })}
              </div>

              <p className="text-center text-sm text-warmgray-500 mt-4">
                + weitere Kategorien wie Familie, Arbeit, Religion und Sonstige
              </p>

              {/* QR Code Section */}
              <div className="mt-6 pt-6 border-t border-warmgray-200">
                {!showQrCode ? (
                  <button
                    onClick={() => setShowQrCode(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-warmgray-300 hover:border-sage-400 hover:bg-sage-50 transition-colors text-warmgray-600 hover:text-sage-700"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>Oder mit dem Handy fotografieren</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-lg bg-sage-50 border border-sage-200">
                    <div className="flex justify-between items-start mb-3">
                      <p className="text-sm font-medium text-warmgray-900">
                        QR-Code scannen
                      </p>
                      <button
                        onClick={() => setShowQrCode(false)}
                        className="text-warmgray-400 hover:text-warmgray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-white p-4 rounded-md flex items-center justify-center">
                      {/* Simple QR Code placeholder - in production use a QR library */}
                      <div className="w-32 h-32 bg-warmgray-100 rounded flex items-center justify-center">
                        <div className="grid grid-cols-5 gap-1">
                          {Array.from({ length: 25 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-4 h-4 ${
                                [0,1,2,4,5,6,10,12,14,18,19,20,22,23,24].includes(i)
                                  ? 'bg-warmgray-900'
                                  : 'bg-white'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-warmgray-500 mt-2 text-center">
                      Scannen Sie diesen Code mit Ihrer Handy-Kamera
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={goToPrevStep}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={skipStep}
                  className="text-warmgray-500"
                >
                  Überspringen
                </Button>
                <Button onClick={goToNextStep}>
                  Weiter
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
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

            {!skippedEmergency ? (
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
              </div>
            ) : (
              <div className="text-center py-8 max-w-md mx-auto">
                <p className="text-warmgray-600 mb-4">
                  Sie können Notfall-Kontakte später unter &quot;Notfall &amp; Vorsorge&quot; hinzufügen.
                </p>
                <button
                  type="button"
                  onClick={() => setSkippedEmergency(false)}
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
              <div className="flex gap-2">
                {!skippedEmergency && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSkippedEmergency(true)
                      goToNextStep()
                    }}
                    className="text-warmgray-500"
                  >
                    Überspringen
                  </Button>
                )}
                <Button
                  onClick={saveEmergencyContact}
                  disabled={isSaving || (!skippedEmergency && (!emergencyForm.name || !emergencyForm.phone || !emergencyForm.relationship))}
                >
                  {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                  Weiter
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
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
                Geschafft!
              </h2>
              <p className="text-warmgray-600 max-w-md mx-auto">
                Ihr Lebensordner ist eingerichtet. Sie können jetzt weitere Dokumente
                hochladen, Erinnerungen erstellen und Ihre Informationen vervollständigen.
              </p>
            </div>

            {/* Optional welcome note */}
            <div className="max-w-md mx-auto text-left">
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200">
                <Label htmlFor="welcome_note" className="text-warmgray-700">
                  Persönliche Notiz für Ihre Angehörigen
                </Label>
                <p className="text-sm text-warmgray-500 mb-3">
                  Das ist optional – Sie können hier eine kurze Nachricht hinterlassen.
                </p>
                <textarea
                  id="welcome_note"
                  value={welcomeNote}
                  onChange={(e) => setWelcomeNote(e.target.value)}
                  placeholder="z.B. Liebe Familie, hier findet ihr alle wichtigen Unterlagen..."
                  className="w-full min-h-[100px] rounded-md border-2 border-warmgray-300 bg-white px-4 py-3 text-base text-gray-900 transition-colors placeholder:text-warmgray-400 focus-visible:outline-none focus-visible:border-sage-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto mt-4">
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200 text-left">
                <FileText className="w-6 h-6 text-sage-600 mb-2" />
                <p className="font-medium text-warmgray-900">Dokumente</p>
                <p className="text-sm text-warmgray-500">Laden Sie weitere wichtige Unterlagen hoch</p>
              </div>
              <div className="p-4 rounded-lg bg-cream-50 border border-cream-200 text-left">
                <HeartPulse className="w-6 h-6 text-sage-600 mb-2" />
                <p className="font-medium text-warmgray-900">Notfall-Infos</p>
                <p className="text-sm text-warmgray-500">Ergänzen Sie medizinische Daten</p>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={goToPrevStep}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Zurück
              </Button>
              <Button onClick={completeOnboarding} size="lg" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                Zum Dashboard
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )
    }
  }

  // Show loading while checking onboarding status
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-sage-600 mx-auto mb-4" />
          <p className="text-warmgray-600">Wird geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 py-8 px-4">
      {/* Resume Dialog */}
      {showResumeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center mx-auto">
                  <ArrowRight className="w-6 h-6 text-sage-600" />
                </div>
                <h3 className="text-lg font-semibold text-warmgray-900">
                  Einrichtung fortsetzen?
                </h3>
                <p className="text-warmgray-600">
                  Sie haben die Einrichtung beim letzten Mal nicht abgeschlossen.
                  Möchten Sie dort weitermachen, wo Sie aufgehört haben?
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button onClick={resumeProgress} className="flex-1">
                    Fortsetzen
                  </Button>
                  <Button variant="outline" onClick={startFresh} className="flex-1">
                    Neu beginnen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-warmgray-500 mb-3">
            <span className="font-medium">Schritt {currentStepIndex + 1} von {STEPS.length}</span>
            <span>{STEPS[currentStepIndex].title}</span>
          </div>
          {/* Step Indicators as dots */}
          <div className="flex justify-center gap-2">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`w-3 h-3 rounded-full transition-colors ${
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

        {/* Step Content */}
        <Card>
          <CardContent className="pt-8 pb-8">
            {renderStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
