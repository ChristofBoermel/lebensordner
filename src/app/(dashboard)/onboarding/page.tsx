'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

// localStorage functions (fallback)
function loadLocalProgress(): OnboardingProgress | null {
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

function saveLocalProgress(progress: OnboardingProgress) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Ignore storage errors
  }
}

function clearLocalProgress() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

// Server functions
async function loadServerProgress(): Promise<OnboardingProgress | null> {
  try {
    const response = await fetch('/api/onboarding/progress')
    if (!response.ok) return null
    const data = await response.json()
    return data.progress || null
  } catch {
    return null
  }
}

async function saveServerProgress(progress: OnboardingProgress): Promise<boolean> {
  try {
    const response = await fetch('/api/onboarding/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    })
    const data = await response.json()
    return data.success === true
  } catch {
    return false
  }
}

async function clearServerProgress(): Promise<void> {
  try {
    await fetch('/api/onboarding/progress', { method: 'DELETE' })
  } catch {
    // Ignore errors
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
  const stepContentRef = useRef<HTMLDivElement>(null)
  const resumeDialogRef = useRef<HTMLDivElement>(null)

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

  // Auto-save progress (both server and localStorage)
  const autoSave = useCallback(async () => {
    const progress: OnboardingProgress = {
      currentStep,
      profileForm,
      emergencyForm,
      skippedEmergency,
      welcomeNote,
    }
    // Always save to localStorage (fast, reliable fallback)
    saveLocalProgress(progress)
    // Also save to server (async, may fail silently)
    saveServerProgress(progress)
  }, [currentStep, profileForm, emergencyForm, skippedEmergency, welcomeNote])

  // Auto-save on changes (debounced effect)
  useEffect(() => {
    if (isInitializing) return
    const timer = setTimeout(autoSave, 500)
    return () => clearTimeout(timer)
  }, [autoSave, isInitializing])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.classList.add('onboarding-accessible')
    try {
      localStorage.setItem('onboarding_accessibility_mode', 'true')
    } catch {
      // Ignore storage errors
    }
    return () => {
      root.classList.remove('onboarding-accessible')
    }
  }, [])

  useEffect(() => {
    if (!showResumeDialog) return
    const dialog = resumeDialogRef.current
    if (!dialog) return

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'))

    const focusable = getFocusable()
    if (focusable[0]) {
      focusable[0].focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showResumeDialog])

  useEffect(() => {
    if (showResumeDialog) return
    const container = stepContentRef.current
    if (!container) return
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'))
    if (focusable[0]) {
      requestAnimationFrame(() => {
        focusable[0].focus()
      })
    }
  }, [currentStep, showResumeDialog])


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
          clearLocalProgress()
          clearServerProgress()
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

        // Check for saved progress - server has priority, localStorage as fallback
        const serverProgress = await loadServerProgress()
        const localProgress = loadLocalProgress()
        const saved = serverProgress || localProgress

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
    clearLocalProgress()
    clearServerProgress()
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
      clearLocalProgress()
      clearServerProgress()

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showResumeDialog || isInitializing) return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'

      if (event.key === 'Escape') {
        event.preventDefault()
        postponeOnboarding()
        return
      }

      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !isEditable
      ) {
        event.preventDefault()
        if (currentStep === 'welcome' || currentStep === 'documents') {
          goToNextStep()
          return
        }
        if (currentStep === 'profile' && !isSaving) {
          saveProfile()
          return
        }
        if (currentStep === 'emergency' && !isSaving) {
          if (skippedEmergency) {
            goToNextStep()
          } else {
            saveEmergencyContact()
          }
          return
        }
        if (currentStep === 'complete' && !isSaving) {
          completeOnboarding()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    completeOnboarding,
    currentStep,
    goToNextStep,
    isInitializing,
    isSaving,
    postponeOnboarding,
    saveEmergencyContact,
    saveProfile,
    showResumeDialog,
    skippedEmergency,
  ])

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-sage-100 flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-sage-700" />
            </div>
            <div>
              <h2 className="text-3xl font-serif font-bold text-warmgray-900 mb-2">
                Willkommen bei Lebensordner Digital
              </h2>
              <p className="text-warmgray-800 text-lg max-w-md mx-auto">
                In wenigen Schritten richten wir gemeinsam Ihren persönlichen Lebensordner ein.
                So haben Sie alle wichtigen Unterlagen an einem sicheren Ort.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300">
                <Shield className="w-8 h-8 text-sage-700 mx-auto mb-2" />
                <p className="font-medium text-warmgray-900">Sicher</p>
                <p className="text-base text-warmgray-700">Ende-zu-Ende verschlüsselt</p>
              </div>
              <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300">
                <FileText className="w-8 h-8 text-sage-700 mx-auto mb-2" />
                <p className="font-medium text-warmgray-900">Organisiert</p>
                <p className="text-base text-warmgray-700">Alle Dokumente strukturiert</p>
              </div>
              <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300">
                <Users className="w-8 h-8 text-sage-700 mx-auto mb-2" />
                <p className="font-medium text-warmgray-900">Vorgesorgt</p>
                <p className="text-base text-warmgray-700">Familie informiert</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Button
                onClick={goToNextStep}
                className="h-14 px-8 text-lg min-w-[160px]"
              >
                In Ruhe beginnen
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                onClick={postponeOnboarding}
                className="h-14 px-8 text-lg min-w-[160px] min-h-[56px]"
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
                <User className="w-8 h-8 text-sage-700" />
              </div>
              <h2 className="text-3xl font-serif font-bold text-warmgray-900 mb-2">
                Ihre persönlichen Daten
              </h2>
              <p className="text-warmgray-800 text-lg">
                Diese Informationen helfen im Notfall bei der Identifikation.
              </p>
            </div>

            <div className="space-y-6 max-w-md mx-auto">
              <div className="space-y-3">
                <Label htmlFor="full_name">Vollständiger Name</Label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-warmgray-700" />
                  <Input
                    id="full_name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Max Mustermann"
                    className="pl-14 text-lg h-14"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="phone">Telefonnummer</Label>
                <div className="relative">
                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-warmgray-700" />
                  <Input
                    id="phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+49 123 456789"
                    className="pl-14 text-lg h-14"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="date_of_birth">Geburtsdatum</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={profileForm.date_of_birth}
                  onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                  className="cursor-pointer text-lg h-14"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="address">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-5 top-4 w-6 h-6 text-warmgray-700" />
                  <textarea
                    id="address"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Musterstraße 1&#10;12345 Musterstadt"
                    className="w-full min-h-[100px] rounded-md border-2 border-warmgray-400 bg-white pl-14 pr-5 py-4 text-lg text-gray-900 transition-colors placeholder:text-warmgray-600 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-[3px] focus-visible:ring-sage-100 focus-visible:ring-offset-4"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                className="min-w-[160px] min-h-[56px]"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={skipStep}
                  className="text-warmgray-700 min-h-[56px] focus-visible:ring-sage-500"
                >
                  Überspringen
                </Button>
                <Button
                  onClick={saveProfile}
                  disabled={isSaving}
                  className="min-w-[160px]"
                >
                  {isSaving ? <Loader2 className="mr-2 w-5 h-5 animate-spin" /> : null}
                  Weiter
                  <ArrowRight className="ml-2 w-5 h-5" />
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
                <Upload className="w-8 h-8 text-sage-700" />
              </div>
              <h2 className="text-3xl font-serif font-bold text-warmgray-900 mb-2">
                Ihre Dokumente organisieren
              </h2>
              <p className="text-warmgray-800 text-lg">
                Nach der Einrichtung können Sie Dokumente in diese Kategorien sortieren:
              </p>
            </div>

            <div className="max-w-lg mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {highlightedCategories.map((catKey) => {
                  const cat = DOCUMENT_CATEGORIES[catKey]
                  const IconComponent = categoryIcons[cat.icon] || FileText
                  return (
                    <div
                      key={catKey}
                      className="p-4 rounded-lg bg-white border-2 border-warmgray-300 text-center"
                    >
                      <IconComponent className="w-8 h-8 text-sage-700 mx-auto mb-2" />
                      <p className="font-medium text-warmgray-900 text-base">{cat.name}</p>
                      <p className="text-base text-warmgray-700 mt-1 truncate">
                        {cat.examples[0]}
                      </p>
                    </div>
                  )
                })}
              </div>

              <p className="text-center text-base text-warmgray-700 mt-4">
                + weitere Kategorien wie Familie, Arbeit, Religion und Sonstige
              </p>

              {/* QR Code Section */}
              <div className="mt-6 pt-6 border-t border-warmgray-200">
                {!showQrCode ? (
                  <button
                    onClick={() => setShowQrCode(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-warmgray-300 hover:border-sage-400 hover:bg-sage-50 transition-colors text-warmgray-800 hover:text-sage-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4"
                  >
                    <Smartphone className="w-6 h-6" />
                    <span>Oder mit dem Handy fotografieren</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-lg bg-sage-50 border-2 border-sage-200">
                    <div className="flex justify-between items-start mb-3">
                      <p className="text-base font-medium text-warmgray-900">
                        QR-Code scannen
                      </p>
                      <button
                        onClick={() => setShowQrCode(false)}
                        className="text-warmgray-600 hover:text-warmgray-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4"
                      >
                        <X className="w-5 h-5" />
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
                    <p className="text-base text-warmgray-700 mt-2 text-center">
                      Scannen Sie diesen Code mit Ihrer Handy-Kamera
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                className="min-w-[160px] min-h-[56px]"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={skipStep}
                  className="text-warmgray-700 min-h-[56px] focus-visible:ring-sage-500"
                >
                  Überspringen
                </Button>
                <Button onClick={goToNextStep} className="min-w-[160px]">
                  Weiter
                  <ArrowRight className="ml-2 w-5 h-5" />
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
                <HeartPulse className="w-8 h-8 text-sage-700" />
              </div>
              <h2 className="text-3xl font-serif font-bold text-warmgray-900 mb-2">
                Ihr erster Notfall-Kontakt
              </h2>
              <p className="text-warmgray-800 text-lg">
                Wer soll im Notfall als erstes kontaktiert werden?
              </p>
            </div>

            {!skippedEmergency ? (
              <div className="space-y-6 max-w-md mx-auto">
                <div className="space-y-3">
                  <Label htmlFor="emergency_name">Name *</Label>
                  <Input
                    id="emergency_name"
                    value={emergencyForm.name}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, name: e.target.value })}
                    placeholder="Name der Person"
                    className="text-lg h-14"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="emergency_phone">Telefonnummer *</Label>
                  <Input
                    id="emergency_phone"
                    type="tel"
                    value={emergencyForm.phone}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, phone: e.target.value })}
                    placeholder="+49 123 456789"
                    className="text-lg h-14"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="emergency_relationship">Beziehung *</Label>
                  <Input
                    id="emergency_relationship"
                    value={emergencyForm.relationship}
                    onChange={(e) => setEmergencyForm({ ...emergencyForm, relationship: e.target.value })}
                    placeholder="z.B. Ehepartner, Sohn, Tochter"
                    className="text-lg h-14"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 max-w-md mx-auto">
                <p className="text-warmgray-800 text-lg mb-4">
                  Sie können Notfall-Kontakte später unter &quot;Notfall &amp; Vorsorge&quot; hinzufügen.
                </p>
                <button
                  type="button"
                  onClick={() => setSkippedEmergency(false)}
                  className="text-sage-700 hover:text-sage-800 underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4"
                >
                  Doch jetzt hinzufügen
                </button>
              </div>
            )}

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                className="min-w-[160px] min-h-[56px]"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
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
                    className="text-warmgray-700 min-h-[56px] focus-visible:ring-sage-500"
                  >
                    Überspringen
                  </Button>
                )}
                <Button
                  onClick={saveEmergencyContact}
                  disabled={isSaving || (!skippedEmergency && (!emergencyForm.name || !emergencyForm.phone || !emergencyForm.relationship))}
                  className="min-w-[160px]"
                >
                  {isSaving ? <Loader2 className="mr-2 w-5 h-5 animate-spin" /> : null}
                  Weiter
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-sage-100 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-sage-700" />
            </div>
            <div>
              <h2 className="text-3xl font-serif font-bold text-warmgray-900 mb-2">
                Geschafft!
              </h2>
              <p className="text-warmgray-800 text-lg max-w-md mx-auto">
                Ihr Lebensordner ist eingerichtet. Sie können jetzt weitere Dokumente
                hochladen, Erinnerungen erstellen und Ihre Informationen vervollständigen.
              </p>
            </div>

            {/* Optional welcome note */}
            <div className="max-w-md mx-auto text-left">
              <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300">
                <Label htmlFor="welcome_note" className="text-warmgray-900">
                  Persönliche Notiz für Ihre Angehörigen
                </Label>
                <p className="text-base text-warmgray-700 mb-3">
                  Das ist optional – Sie können hier eine kurze Nachricht hinterlassen.
                </p>
                <textarea
                  id="welcome_note"
                  value={welcomeNote}
                  onChange={(e) => setWelcomeNote(e.target.value)}
                  placeholder="z.B. Liebe Familie, hier findet ihr alle wichtigen Unterlagen..."
                  className="w-full min-h-[100px] rounded-md border-2 border-warmgray-300 bg-white pl-5 pr-5 py-4 text-lg text-gray-900 transition-colors placeholder:text-warmgray-600 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-[3px] focus-visible:ring-sage-100 focus-visible:ring-offset-4"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto mt-4">
              <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300 text-left">
                <FileText className="w-6 h-6 text-sage-700 mb-2" />
                <p className="font-medium text-warmgray-900">Dokumente</p>
                <p className="text-base text-warmgray-700">Laden Sie weitere wichtige Unterlagen hoch</p>
              </div>
              <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300 text-left">
                <HeartPulse className="w-6 h-6 text-sage-700 mb-2" />
                <p className="font-medium text-warmgray-900">Notfall-Infos</p>
                <p className="text-base text-warmgray-700">Ergänzen Sie medizinische Daten</p>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                className="min-w-[160px] min-h-[56px]"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Zurück
              </Button>
              <Button
                onClick={completeOnboarding}
                disabled={isSaving}
                className="h-14 px-8 text-lg min-w-[160px]"
              >
                {isSaving ? <Loader2 className="mr-2 w-5 h-5 animate-spin" /> : null}
                Zum Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
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
          <Loader2 className="w-8 h-8 animate-spin text-sage-700 mx-auto mb-4" />
          <p className="text-warmgray-800 text-lg">Wird geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 py-8 px-4">
      {/* Resume Dialog */}
      {showResumeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card
            className="max-w-md w-full"
            ref={resumeDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-resume-title"
            aria-describedby="onboarding-resume-description"
          >
            <CardContent className="pt-6">
              <div className="text-center space-y-6">
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center mx-auto">
                  <ArrowRight className="w-6 h-6 text-sage-700" />
                </div>
                <h3 id="onboarding-resume-title" className="text-lg font-semibold text-warmgray-900">
                  Einrichtung fortsetzen?
                </h3>
                <p id="onboarding-resume-description" className="text-warmgray-800 text-lg">
                  Sie haben die Einrichtung beim letzten Mal nicht abgeschlossen.
                  Möchten Sie dort weitermachen, wo Sie aufgehört haben?
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button onClick={resumeProgress} className="flex-1 h-14 px-8 text-lg">
                    Fortsetzen
                  </Button>
                  <Button variant="outline" onClick={startFresh} className="flex-1 min-h-[56px]">
                    Neu beginnen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <div aria-live="polite" className="sr-only">
          Schritt {currentStepIndex + 1}: {STEPS[currentStepIndex].title}
        </div>
        {/* Progress */}
        <div
          className="mb-8"
          aria-label={`Schritt ${currentStepIndex + 1} von ${STEPS.length}`}
          tabIndex={0}
        >
          <div className="flex justify-between text-base font-medium text-warmgray-700 mb-3">
            <span>Schritt {currentStepIndex + 1} von {STEPS.length}</span>
            <span>{STEPS[currentStepIndex].title}</span>
          </div>
          {/* Step Indicators as dots */}
          <div className="flex justify-center gap-3">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`w-4 h-4 rounded-full transition-colors ${
                  index === currentStepIndex
                    ? 'bg-sage-700'
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
          <CardContent className="pt-10 pb-10 px-8">
            <div ref={stepContentRef}>{renderStep()}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
