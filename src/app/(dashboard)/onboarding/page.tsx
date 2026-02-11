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
  Users, Briefcase, Church, FolderOpen, Smartphone, X,
  Heart, Calendar, ChevronDown, Zap, Printer, Mail, Download,
  ExternalLink
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'
import { HelpTooltip } from '@/components/onboarding/help-tooltip'
import { ExpandableHelp } from '@/components/onboarding/expandable-help'
import { FloatingHelpButton } from '@/components/onboarding/floating-help-button'
import { ProgressiveField } from '@/components/onboarding/progressive-field'
import { StepFeedbackWidget } from '@/components/onboarding/step-feedback-widget'
import { PrintGuideButton } from '@/components/onboarding/print-guide'
import { DownloadChecklistButton } from '@/components/onboarding/checklist-download'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'

type Step = 'welcome' | 'profile' | 'documents' | 'emergency' | 'complete'

const STEPS: { id: Step; title: string; description: string }[] = [
  { id: 'welcome', title: 'Willkommen', description: 'Einführung in Lebensordner' },
  { id: 'profile', title: 'Ihr Profil', description: 'Persönliche Daten' },
  { id: 'documents', title: 'Dokumente', description: 'Übersicht der Kategorien' },
  { id: 'emergency', title: 'Notfall-Kontakt', description: 'Erster Ansprechpartner' },
  { id: 'complete', title: 'Fertig!', description: 'Einrichtung abgeschlossen' },
]

const STORAGE_KEY = 'onboarding_progress'

// Profile field configurations for progressive disclosure
const PROFILE_FIELDS = [
  {
    key: 'full_name' as const,
    label: 'Vollständiger Name',
    type: 'text' as const,
    placeholder: 'z.B. Max Mustermann',
    helpTitle: 'Vollständiger Name',
    helpContent: 'Ihr vollständiger Name hilft im Notfall bei der eindeutigen Identifikation. Bitte geben Sie Vor- und Nachname wie im Personalausweis an.',
    inputId: 'full_name',
  },
  {
    key: 'phone' as const,
    label: 'Telefonnummer',
    type: 'tel' as const,
    placeholder: '+49 30 12345678',
    helpTitle: 'Telefonnummer',
    helpContent: 'Ihre Telefonnummer ermöglicht es Notfallkontakten, Sie schnell zu erreichen. Format: +49 für Deutschland, dann Vorwahl ohne 0. Beispiel: +49 30 12345678',
    inputId: 'phone',
  },
  {
    key: 'date_of_birth' as const,
    label: 'Geburtsdatum',
    type: 'date' as const,
    placeholder: '01.01.1950',
    helpTitle: 'Geburtsdatum',
    helpContent: 'Das Geburtsdatum wird für wichtige Dokumente und zur Altersverifikation benötigt. Diese Information bleibt privat und sicher.',
    inputId: 'date_of_birth',
  },
  {
    key: 'address' as const,
    label: 'Adresse',
    type: 'textarea' as const,
    placeholder: 'Hauptstraße 45\n10115 Berlin',
    helpTitle: 'Adresse',
    helpContent: 'Ihre Adresse ist wichtig für offizielle Dokumente und Notfallkontakte. Geben Sie Straße, Hausnummer, PLZ und Ort an.',
    inputId: 'address',
  },
]

// Emergency field configurations for progressive disclosure
const EMERGENCY_FIELDS = [
  {
    key: 'name' as const,
    label: 'Name *',
    type: 'text' as const,
    placeholder: 'z.B. Anna Müller',
    helpTitle: 'Notfallkontakt',
    helpContent: 'Wer soll als erstes informiert werden, wenn etwas passiert? Dies sollte eine Person sein, der Sie vertrauen.',
    inputId: 'emergency_name',
  },
  {
    key: 'phone' as const,
    label: 'Telefonnummer *',
    type: 'tel' as const,
    placeholder: '+49 176 98765432',
    helpTitle: 'Telefonnummer',
    helpContent: 'Die Telefonnummer Ihrer Notfallkontaktperson. Stellen Sie sicher, dass diese Nummer aktuell ist.',
    inputId: 'emergency_phone',
  },
  {
    key: 'relationship' as const,
    label: 'Beziehung *',
    type: 'text' as const,
    placeholder: 'z.B. Tochter',
    helpTitle: 'Beziehung',
    helpContent: 'Beschreiben Sie Ihre Beziehung zu dieser Person. Beispiele: Ehepartner/in, Tochter, Sohn, Schwester, bester Freund.',
    inputId: 'emergency_relationship',
  },
]

// Icons for profile fields
const PROFILE_ICONS = [
  <User key="user" className="w-6 h-6" />,
  <Phone key="phone" className="w-6 h-6" />,
  <Calendar key="calendar" className="w-6 h-6" />,
  <MapPin key="mappin" className="w-6 h-6" />,
]

// Icons for emergency fields
const EMERGENCY_ICONS = [
  <User key="user" className="w-6 h-6" />,
  <Phone key="phone" className="w-6 h-6" />,
  <Heart key="heart" className="w-6 h-6" />,
]

// Priority document categories shown initially
const PRIORITY_CATEGORIES: DocumentCategory[] = ['identitaet', 'finanzen', 'versicherungen', 'gesundheit']

// All document categories (remaining after priority)
const ALL_CATEGORY_KEYS = Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]

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
  profileFieldIndex: number
  emergencyFieldIndex: number
  documentCategoriesExpanded: boolean
  quickStartMode: boolean
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
    profileFieldIndex: 0,
    emergencyFieldIndex: 0,
    documentCategoriesExpanded: false,
    quickStartMode: false,
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
  const onboardingLabelClass =
    'mb-2.5 text-lg font-semibold text-warmgray-900 leading-relaxed'
  const router = useRouter()
  const supabase = createClient()
  const stepContentRef = useRef<HTMLDivElement>(null)
  const resumeDialogRef = useRef<HTMLDivElement>(null)
  const { capture } = usePostHog()

  // Time tracking state
  const [stepStartTime, setStepStartTime] = useState<number>(Date.now())
  const [stepTimings, setStepTimings] = useState<Record<string, number>>({})

  // Feedback widget state
  const [showFeedbackWidget, setShowFeedbackWidget] = useState(false)
  const [feedbackStep, setFeedbackStep] = useState<Step>('welcome')
  const [pendingNextStep, setPendingNextStep] = useState<Step | null>(null)

  // Exit survey state
  const [showExitSurvey, setShowExitSurvey] = useState(false)
  const [exitReason, setExitReason] = useState('')
  const [exitComments, setExitComments] = useState('')

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false)

  // Email guide state
  const [emailSent, setEmailSent] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isPrintingStep, setIsPrintingStep] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userFullName, setUserFullName] = useState('')

  // Help center QR code
  const [helpQrDataUrl, setHelpQrDataUrl] = useState<string | null>(null)

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

  // Progressive disclosure states
  const [profileFieldIndex, setProfileFieldIndex] = useState(0)
  const [emergencyFieldIndex, setEmergencyFieldIndex] = useState(0)
  const [fieldSaved, setFieldSaved] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [quickStartMode, setQuickStartMode] = useState(false)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [skipDialogStep, setSkipDialogStep] = useState<'profile' | 'emergency'>('profile')

  // Auto-save progress (both server and localStorage)
  const autoSave = useCallback(async () => {
    const progress: OnboardingProgress = {
      currentStep,
      profileForm,
      emergencyForm,
      skippedEmergency,
      welcomeNote,
      profileFieldIndex,
      emergencyFieldIndex,
      documentCategoriesExpanded: showAllCategories,
      quickStartMode,
    }
    // Always save to localStorage (fast, reliable fallback)
    saveLocalProgress(progress)
    // Also save to server (async, may fail silently)
    saveServerProgress(progress)
  }, [currentStep, profileForm, emergencyForm, skippedEmergency, welcomeNote, profileFieldIndex, emergencyFieldIndex, showAllCategories, quickStartMode])

  // Auto-save on changes (debounced effect)
  useEffect(() => {
    if (isInitializing) return
    const timer = setTimeout(autoSave, 500)
    return () => clearTimeout(timer)
  }, [autoSave, isInitializing])

  // Time tracking: record elapsed time when step changes
  const previousStepRef = useRef<Step>(currentStep)
  useEffect(() => {
    if (isInitializing) return
    const prevStep = previousStepRef.current
    if (prevStep !== currentStep) {
      const elapsed = Math.round((Date.now() - stepStartTime) / 1000)
      setStepTimings(prev => ({ ...prev, [prevStep]: (prev[prevStep] || 0) + elapsed }))
      setStepStartTime(Date.now())
      previousStepRef.current = currentStep

      // Track step entry in PostHog
      capture(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, {
        step: prevStep,
        nextStep: currentStep,
        timeSpent: elapsed,
      })
    }
  }, [currentStep, isInitializing, stepStartTime, capture])

  // Celebration trigger when reaching complete step
  useEffect(() => {
    if (currentStep === 'complete') {
      const timer = setTimeout(() => setShowCelebration(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShowCelebration(false)
    }
  }, [currentStep])

  // Helper to get time spent on a step
  const getStepTimeSpent = useCallback((step: Step): number => {
    if (step === currentStep) {
      return Math.round((Date.now() - stepStartTime) / 1000)
    }
    return stepTimings[step] || 0
  }, [currentStep, stepStartTime, stepTimings])

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
          capture(ANALYTICS_EVENTS.ONBOARDING_STARTED, {
            isResume: true,
            quickStartMode: saved.quickStartMode,
          })
        } else {
          capture(ANALYTICS_EVENTS.ONBOARDING_STARTED, {
            isResume: false,
            quickStartMode: false,
          })
        }

        // Pre-fill profile form if data exists in database
        if (profile) {
          setProfileForm(prev => ({
            full_name: profile.full_name || prev.full_name || '',
            phone: profile.phone || prev.phone || '',
            date_of_birth: profile.date_of_birth || prev.date_of_birth || '',
            address: profile.address || prev.address || '',
          }))
          if (profile.full_name) setUserFullName(profile.full_name)
        }

        // Store user email for completion screen
        if (user.email) setUserEmail(user.email)
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
      // Restore field-level progress
      const pfi = savedProgress.profileFieldIndex
      setProfileFieldIndex(pfi != null && pfi >= 0 && pfi < PROFILE_FIELDS.length ? pfi : 0)
      const efi = savedProgress.emergencyFieldIndex
      setEmergencyFieldIndex(efi != null && efi >= 0 && efi < EMERGENCY_FIELDS.length ? efi : 0)
      setShowAllCategories(savedProgress.documentCategoriesExpanded ?? false)
      setQuickStartMode(savedProgress.quickStartMode ?? false)
    }
    setShowResumeDialog(false)
  }

  const startFresh = () => {
    clearLocalProgress()
    clearServerProgress()
    const defaults = getDefaultProgress()
    setCurrentStep('welcome')
    setProfileForm(defaults.profileForm)
    setEmergencyForm(defaults.emergencyForm)
    setSkippedEmergency(false)
    setWelcomeNote('')
    setProfileFieldIndex(0)
    setEmergencyFieldIndex(0)
    setShowAllCategories(false)
    setQuickStartMode(false)
    setShowResumeDialog(false)
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      // Show feedback widget for non-welcome steps
      if (currentStep !== 'welcome') {
        setFeedbackStep(currentStep)
        setPendingNextStep(STEPS[nextIndex].id)
        setShowFeedbackWidget(true)
      } else {
        setCurrentStep(STEPS[nextIndex].id)
      }
    }
  }

  // Proceed to next step after feedback is submitted or skipped
  const proceedToNextStep = () => {
    setShowFeedbackWidget(false)
    if (pendingNextStep) {
      setCurrentStep(pendingNextStep)
      setPendingNextStep(null)
    }
  }

  // Handle feedback submission
  const handleFeedbackSubmit = async (data: { clarityRating: number; comments: string; timeSpentSeconds: number }) => {
    try {
      await fetch('/api/onboarding/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepName: feedbackStep,
          clarityRating: data.clarityRating,
          comments: data.comments || null,
          timeSpentSeconds: data.timeSpentSeconds,
        }),
      })
      capture('onboarding_feedback_submitted', {
        step: feedbackStep,
        clarityRating: data.clarityRating,
        hasComments: !!data.comments,
        timeSpent: data.timeSpentSeconds,
      })
    } catch {
      // Don't block navigation on feedback errors
    }
    proceedToNextStep()
  }

  // Handle feedback skip
  const handleFeedbackSkip = () => {
    capture('onboarding_feedback_skipped', { step: feedbackStep })
    proceedToNextStep()
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const handleSkipRequest = (step: 'profile' | 'emergency') => {
    setSkipDialogStep(step)
    setShowSkipDialog(true)
  }

  const confirmSkip = () => {
    setShowSkipDialog(false)
    if (skipDialogStep === 'profile') {
      if (quickStartMode) {
        setCurrentStep('emergency')
        setProfileFieldIndex(0)
        return
      }
      goToNextStep()
      return
    }
    if (skipDialogStep === 'emergency') {
      setSkippedEmergency(true)
    }
    goToNextStep()
  }

  // Field-level auto-save with visual feedback
  const saveFieldWithFeedback = useCallback(() => {
    autoSave()
    setFieldSaved(true)
    const timer = setTimeout(() => setFieldSaved(false), 1500)
    return () => clearTimeout(timer)
  }, [autoSave])

  // Profile progressive field handlers
  const handleProfileFieldNext = () => {
    saveFieldWithFeedback()
    if (profileFieldIndex < PROFILE_FIELDS.length - 1) {
      setProfileFieldIndex(profileFieldIndex + 1)
    } else {
      // Last field - save and move to next step
      saveProfile()
    }
  }

  const handleProfileFieldPrevious = () => {
    if (profileFieldIndex > 0) {
      setProfileFieldIndex(profileFieldIndex - 1)
    }
  }

  // Emergency progressive field handlers
  const handleEmergencyFieldNext = () => {
    saveFieldWithFeedback()
    if (emergencyFieldIndex < EMERGENCY_FIELDS.length - 1) {
      setEmergencyFieldIndex(emergencyFieldIndex + 1)
    } else {
      // Last field - save and move to next step
      saveEmergencyContact()
    }
  }

  const handleEmergencyFieldPrevious = () => {
    if (emergencyFieldIndex > 0) {
      setEmergencyFieldIndex(emergencyFieldIndex - 1)
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

      if (quickStartMode) {
        // In quick start: skip documents, show feedback then go to emergency
        setFeedbackStep('profile')
        setPendingNextStep('emergency')
        setShowFeedbackWidget(true)
      } else {
        goToNextStep()
      }
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

      // In quick start mode, skip directly to complete (with feedback)
      if (quickStartMode) {
        setFeedbackStep('emergency')
        setPendingNextStep('complete')
        setShowFeedbackWidget(true)
      } else {
        goToNextStep()
      }
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

      // Track completion in PostHog
      const totalTime = Object.values(stepTimings).reduce((sum, t) => sum + t, 0) + getStepTimeSpent('complete')
      capture(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
        totalTime,
        quickStartMode,
        skippedEmergency,
      })

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
    // Show exit survey instead of navigating immediately
    setShowExitSurvey(true)
  }

  // Handle exit survey submission
  const handleExitSurveySubmit = async () => {
    try {
      const timeSpent = getStepTimeSpent(currentStep)
      await fetch('/api/onboarding/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepName: currentStep,
          clarityRating: 3, // Neutral default for exit surveys
          comments: `[Exit] ${exitReason}${exitComments ? `: ${exitComments}` : ''}`,
          timeSpentSeconds: timeSpent,
        }),
      })
      capture('onboarding_exit_survey_submitted', {
        step: currentStep,
        reason: exitReason,
        hasComments: !!exitComments,
        timeSpent,
      })
    } catch {
      // Don't block navigation on error
    }
    capture(ANALYTICS_EVENTS.ONBOARDING_SKIPPED, {
      step: currentStep,
      reason: exitReason || 'postponed',
      timeSpent: getStepTimeSpent(currentStep),
    })
    setShowExitSurvey(false)
    autoSave()
    router.push('/dashboard')
  }

  // Skip exit survey and just leave
  const handleExitSurveyCancel = () => {
    setShowExitSurvey(false)
  }

  // Quick exit without survey (for Escape key)
  const handleQuickPostpone = () => {
    capture(ANALYTICS_EVENTS.ONBOARDING_SKIPPED, {
      step: currentStep,
      reason: 'escape_key',
      timeSpent: getStepTimeSpent(currentStep),
    })
    autoSave()
    router.push('/dashboard')
  }

  // Quick start mode handler
  const startQuickMode = () => {
    setQuickStartMode(true)
    setProfileFieldIndex(0)
    setCurrentStep('profile')
  }

  // Email instructions handler
  const handleEmailInstructions = async () => {
    setIsSendingEmail(true)
    try {
      const response = await fetch('/api/onboarding/send-guide', {
        method: 'POST',
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success) {
        setEmailSent(true)
        capture('onboarding_guide_emailed')
        return
      }
      if (response.status === 429) {
        alert('E-Mail wurde k\u00fcrzlich gesendet. Bitte warten Sie einige Minuten.')
        return
      }
      const message =
        typeof data?.error === 'string'
          ? data.error
          : 'Fehler beim Senden. Bitte versuchen Sie es sp\u00e4ter erneut.'
      alert(message)
    } catch {
      alert('Fehler beim Senden. Bitte versuchen Sie es sp\u00e4ter erneut.')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const generateStepPdf = async (step: Step) => {
    const jsPDFModule = await import('jspdf')
    const jsPDF = jsPDFModule.default
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 18
    const contentWidth = pageWidth - margin * 2
    let y = 24

    const ensureSpace = (space: number) => {
      if (y + space > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
    }

    const addTitle = (text: string) => {
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text(text, margin, y)
      y += 12
    }

    const addSubtitle = (text: string) => {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(text, contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * 6 + 4
    }

    const addSection = (text: string) => {
      ensureSpace(18)
      doc.setFontSize(15)
      doc.setFont('helvetica', 'bold')
      doc.text(text, margin, y)
      y += 8
    }

    const addBody = (text: string, size: number = 12) => {
      ensureSpace(16)
      doc.setFontSize(size)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(text, contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * (size * 0.45) + 4
    }

    const addKeyValue = (label: string, value: string) => {
      ensureSpace(16)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, margin, y)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(value, contentWidth - 30)
      doc.text(lines, margin + 26, y)
      y += lines.length * 6 + 4
    }

    const stepMeta = STEPS.find((item) => item.id === step)
    addTitle(`Lebensordner \u2013 ${stepMeta?.title ?? 'Schritt'}`)
    addSubtitle(stepMeta?.description ?? '')

    if (step === 'welcome') {
      addSection('Was Sie erwartet')
      addBody(
        'Wir richten Ihren digitalen Lebensordner Schritt f\u00fcr Schritt ein. So sind Ihre wichtigsten Unterlagen sicher und jederzeit verf\u00fcgbar.'
      )
      addSection('Vorteile auf einen Blick')
      addKeyValue('Sicher', 'Ende-zu-Ende verschl\u00fcsselte Ablage')
      addKeyValue('Organisiert', 'Alle Dokumente klar strukturiert')
      addKeyValue('Vorgesorgt', 'Familie und Vertrauenspersonen informiert')
    }

    if (step === 'profile') {
      addSection('Ihre Eingaben')
      const fields = quickStartMode ? [PROFILE_FIELDS[0]] : PROFILE_FIELDS
      fields.forEach((field) => {
        addKeyValue(field.label, profileForm[field.key] || 'Noch nicht ausgef\u00fcllt')
        addBody(`Hilfe: ${field.helpContent}`, 11)
      })
      if (quickStartMode) {
        addBody('Hinweis: Sie befinden sich im Quick-Start-Modus.', 11)
      }
    }

    if (step === 'documents') {
      addSection('Wichtige Kategorien')
      PRIORITY_CATEGORIES.forEach((categoryKey) => {
        const category = DOCUMENT_CATEGORIES[categoryKey]
        addKeyValue(category.name, category.description)
        addBody(`Beispiele: ${category.examples.join(', ')}`, 11)
      })
      addSection('Weitere Kategorien')
      ALL_CATEGORY_KEYS.filter((key) => !PRIORITY_CATEGORIES.includes(key)).forEach((categoryKey) => {
        const category = DOCUMENT_CATEGORIES[categoryKey]
        addKeyValue(category.name, category.description)
      })
    }

    if (step === 'emergency') {
      if (skippedEmergency) {
        addBody('Dieser Schritt wurde \u00fcbersprungen. Sie k\u00f6nnen sp\u00e4ter einen Notfallkontakt hinzuf\u00fcgen.')
      } else {
        addSection('Notfallkontakt')
        EMERGENCY_FIELDS.forEach((field) => {
          addKeyValue(field.label.replace('*', '').trim(), emergencyForm[field.key] || 'Noch nicht ausgef\u00fcllt')
          addBody(`Hilfe: ${field.helpContent}`, 11)
        })
      }
    }

    if (step === 'complete') {
      addSection('N\u00e4chste Schritte')
      addBody(
        quickStartMode
          ? 'Sie k\u00f6nnen Ihr Profil jederzeit vervollst\u00e4ndigen und weitere Dokumente hochladen.'
          : 'Sie k\u00f6nnen jetzt weitere Dokumente hochladen, Erinnerungen erstellen und Informationen erg\u00e4nzen.'
      )
      if (welcomeNote.trim()) {
        addSection('Pers\u00f6nliche Notiz')
        addBody(welcomeNote)
      }
      addSection('Ressourcen')
      addBody('Anleitung drucken, per E-Mail senden oder Checkliste herunterladen.')
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      addBody(`Hilfe & Tutorials: ${origin}/hilfe#video-tutorials`, 11)
    }

    return doc
  }

  const handlePrintStep = async (step: Step) => {
    setIsPrintingStep(true)
    try {
      const doc = await generateStepPdf(step)
      const dateStr = new Date().toISOString().split('T')[0]
      doc.save(`lebensordner-schritt-${step}-${dateStr}.pdf`)
      capture('onboarding_step_printed', { step, type: 'step' })
    } catch (error) {
      console.error('Step PDF generation error:', error)
    } finally {
      setIsPrintingStep(false)
    }
  }

  const renderStepPrintButton = (step: Step) => (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePrintStep(step)}
        disabled={isPrintingStep}
        className="print-include"
      >
        {isPrintingStep ? (
          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
        ) : (
          <Printer className="mr-2 w-4 h-4" />
        )}
        {isPrintingStep ? 'Wird erstellt...' : 'Print This Step'}
      </Button>
    </div>
  )

  // Generate help center QR code when reaching completion step
  useEffect(() => {
    if (currentStep !== 'complete') return
    const generateHelpQr = async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const helpUrl = `${window.location.origin}/hilfe#video-tutorials`
        const dataUrl = await QRCode.toDataURL(helpUrl, {
          width: 200,
          margin: 2,
          color: { dark: '#1a1a1a', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        })
        setHelpQrDataUrl(dataUrl)
      } catch {
        // QR code is optional, don't fail
      }
    }
    generateHelpQr()
  }, [currentStep])

  // Determine fields to show in quick start mode
  const activeProfileFields = quickStartMode ? [PROFILE_FIELDS[0]] : PROFILE_FIELDS
  const activeProfileIcons = quickStartMode ? [PROFILE_ICONS[0]] : PROFILE_ICONS

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showResumeDialog || isInitializing || showSkipDialog || showFeedbackWidget || showExitSurvey) return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'

      if (event.key === 'Escape') {
        event.preventDefault()
        handleQuickPostpone()
        return
      }

      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        // In progressive field mode, Enter is handled by the field component
        if ((currentStep === 'profile' || currentStep === 'emergency') && isEditable) {
          return
        }

        if (!isEditable) {
          event.preventDefault()
          if (currentStep === 'welcome' || currentStep === 'documents') {
            goToNextStep()
            return
          }
          if (currentStep === 'profile' && !isSaving) {
            handleProfileFieldNext()
            return
          }
          if (currentStep === 'emergency' && !isSaving) {
            if (skippedEmergency) {
              goToNextStep()
            } else {
              handleEmergencyFieldNext()
            }
            return
          }
          if (currentStep === 'complete' && !isSaving) {
            completeOnboarding()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
          return (
            <div className="text-center space-y-6">
              {renderStepPrintButton('welcome')}
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
                size="onboarding"
                className="min-w-[160px]"
              >
                In Ruhe beginnen
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                onClick={startQuickMode}
                size="onboarding"
                className="min-w-[160px]"
              >
                <Zap className="mr-2 w-5 h-5" />
                Schnellstart (2 Min.)
              </Button>
              <Button
                variant="ghost"
                onClick={postponeOnboarding}
                size="onboarding"
                className="min-w-[160px] text-warmgray-700"
              >
                Später weiterlesen
              </Button>
            </div>
          </div>
        )

      case 'profile': {
        const currentField = activeProfileFields[profileFieldIndex]
        const currentIcon = activeProfileIcons[profileFieldIndex]
        if (!currentField) return null

        return (
          <div className="space-y-6">
            {renderStepPrintButton('profile')}
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

            <div className="max-w-md mx-auto">
              <ExpandableHelp title="Warum brauchen wir diese Informationen?">
                Ihre persönlichen Daten werden sicher verschlüsselt gespeichert. Im Notfall können Ihre Vertrauenspersonen diese Informationen nutzen, um wichtige Dokumente zuzuordnen und Sie zu kontaktieren. Alle Angaben sind optional, aber je vollständiger Ihr Profil, desto besser können wir Ihnen helfen.
              </ExpandableHelp>
            </div>

            <ProgressiveField
              fieldLabel={currentField.label}
              fieldValue={profileForm[currentField.key]}
              onChange={(value) => setProfileForm({ ...profileForm, [currentField.key]: value })}
              fieldIndex={profileFieldIndex}
              totalFields={activeProfileFields.length}
              onNext={handleProfileFieldNext}
              onPrevious={handleProfileFieldPrevious}
              helpContent={currentField.helpContent}
              helpTitle={currentField.helpTitle}
              placeholder={currentField.placeholder}
              inputType={currentField.type}
              icon={currentIcon}
              isLastField={profileFieldIndex === activeProfileFields.length - 1}
              isSaved={fieldSaved}
              inputId={currentField.inputId}
            />

            <div className="flex justify-between max-w-md mx-auto pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (profileFieldIndex === 0) {
                    goToPrevStep()
                  } else {
                    handleProfileFieldPrevious()
                  }
                }}
                size="onboarding"
                className="min-w-[140px]"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Zurück
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleSkipRequest('profile')}
                size="onboarding"
                className="text-warmgray-700 focus-visible:ring-sage-500"
              >
                Überspringen
              </Button>
            </div>
          </div>
        )
      }

      case 'documents': {
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

        const categoriesToShow = showAllCategories ? ALL_CATEGORY_KEYS : PRIORITY_CATEGORIES

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
                {categoriesToShow.map((catKey) => {
                  const cat = DOCUMENT_CATEGORIES[catKey]
                  const IconComponent = categoryIcons[cat.icon] || FileText
                  return (
                    <div
                      key={catKey}
                      className="p-5 rounded-lg bg-white border-2 border-warmgray-300 text-center min-h-[140px] flex flex-col items-center"
                    >
                      <div className="bg-sage-50 rounded-full p-3 mb-2">
                        <IconComponent className="w-8 h-8 text-sage-700" />
                      </div>
                      <p className="font-medium text-warmgray-900 text-lg">{cat.name}</p>
                      <ul className="text-base text-warmgray-700 mt-1 space-y-0.5">
                        {cat.examples.slice(0, 2).map((example, i) => (
                          <li key={i}>• {example}</li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>

              {/* Expand/Collapse button */}
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="onboarding"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="gap-2"
                >
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showAllCategories ? 'rotate-180' : ''}`} />
                  {showAllCategories ? 'Weniger anzeigen' : 'Weitere Kategorien anzeigen'}
                </Button>
              </div>

              <p className="text-center text-base text-warmgray-700 mt-4">
                Keine Sorge – Sie müssen nicht alle Kategorien nutzen. Laden Sie nur die Dokumente hoch, die für Sie wichtig sind. Sie können jederzeit weitere hinzufügen.
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
                size="onboarding"
                className="min-w-[160px]"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Zurück
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => goToNextStep()}
                  size="onboarding"
                  className="text-warmgray-700 focus-visible:ring-sage-500"
                >
                  Überspringen
                </Button>
                <Button onClick={goToNextStep} size="onboarding" className="min-w-[160px]">
                  Weiter
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )
      }

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

            <div className="max-w-md mx-auto">
              <ExpandableHelp title="Warum ist ein Notfallkontakt wichtig?">
                Ein Notfallkontakt stellt sicher, dass im Ernstfall jemand Zugriff auf Ihre wichtigen Dokumente erhält. Diese Person kann Ihre Patientenverfügung, Versicherungsdaten und andere wichtige Unterlagen einsehen. Sie können später weitere Kontakte hinzufügen.
              </ExpandableHelp>
            </div>

            {!skippedEmergency ? (
              <>
                <ProgressiveField
                  fieldLabel={EMERGENCY_FIELDS[emergencyFieldIndex].label}
                  fieldValue={emergencyForm[EMERGENCY_FIELDS[emergencyFieldIndex].key]}
                  onChange={(value) => setEmergencyForm({ ...emergencyForm, [EMERGENCY_FIELDS[emergencyFieldIndex].key]: value })}
                  fieldIndex={emergencyFieldIndex}
                  totalFields={EMERGENCY_FIELDS.length}
                  onNext={handleEmergencyFieldNext}
                  onPrevious={handleEmergencyFieldPrevious}
                  helpContent={EMERGENCY_FIELDS[emergencyFieldIndex].helpContent}
                  helpTitle={EMERGENCY_FIELDS[emergencyFieldIndex].helpTitle}
                  placeholder={EMERGENCY_FIELDS[emergencyFieldIndex].placeholder}
                  inputType={EMERGENCY_FIELDS[emergencyFieldIndex].type}
                  icon={EMERGENCY_ICONS[emergencyFieldIndex]}
                  isLastField={emergencyFieldIndex === EMERGENCY_FIELDS.length - 1}
                  isSaved={fieldSaved}
                  inputId={EMERGENCY_FIELDS[emergencyFieldIndex].inputId}
                />

                <div className="flex justify-between max-w-md mx-auto pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (emergencyFieldIndex === 0) {
                        goToPrevStep()
                      } else {
                        handleEmergencyFieldPrevious()
                      }
                    }}
                    size="onboarding"
                    className="min-w-[140px]"
                  >
                    <ArrowLeft className="mr-2 w-5 h-5" />
                    Zurück
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleSkipRequest('emergency')}
                    size="onboarding"
                    className="text-warmgray-700 focus-visible:ring-sage-500"
                  >
                    Überspringen
                  </Button>
                </div>
              </>
            ) : (
              <>
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

                <div className="flex justify-between max-w-md mx-auto pt-4">
                  <Button
                    variant="outline"
                    onClick={goToPrevStep}
                    size="onboarding"
                    className="min-w-[160px]"
                  >
                    <ArrowLeft className="mr-2 w-5 h-5" />
                    Zurück
                  </Button>
                  <Button
                    onClick={() => goToNextStep()}
                    size="onboarding"
                    className="min-w-[160px]"
                  >
                    Weiter
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )

      case 'complete':
        return (
          <div className="text-center space-y-6">
            {renderStepPrintButton('complete')}
            {/* Section 1: Celebration */}
            <div className={`w-20 h-20 rounded-full bg-sage-100 flex items-center justify-center mx-auto transition-transform duration-500 ${showCelebration ? 'scale-110' : ''}`}>
              <Check className={`w-10 h-10 text-sage-700 transition-transform duration-500 ${showCelebration ? 'scale-125' : ''}`} />
            </div>

            {showCelebration && (
              <div className="animate-fade-in" aria-live="polite">
                <p className="text-4xl mb-2" aria-hidden="true">&#127881;</p>
                <h2 className="text-3xl font-serif font-bold text-warmgray-900 mb-2">
                  Herzlichen Gl&uuml;ckwunsch!
                </h2>
                <p className="text-warmgray-800 text-lg max-w-md mx-auto">
                  Sie haben die Einrichtung erfolgreich abgeschlossen. Ihr Lebensordner ist jetzt bereit!
                </p>
              </div>
            )}
            {!showCelebration && (
              <div>
                <h2 className="text-3xl font-serif font-bold text-warmgray-900 mb-2">
                  Geschafft!
                </h2>
              </div>
            )}
            <p className="text-warmgray-800 text-lg max-w-md mx-auto">
              {quickStartMode
                ? 'Sie k\u00f6nnen jederzeit Ihr Profil vervollst\u00e4ndigen, weitere Dokumente hochladen und zus\u00e4tzliche Informationen erg\u00e4nzen.'
                : 'Sie k\u00f6nnen jetzt weitere Dokumente hochladen, Erinnerungen erstellen und Ihre Informationen vervollst\u00e4ndigen.'}
            </p>

            {/* Optional welcome note */}
            <div className="max-w-md mx-auto text-left">
              <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300">
                <Label htmlFor="welcome_note" className={onboardingLabelClass}>
                  Pers&ouml;nliche Notiz f&uuml;r Ihre Angeh&ouml;rigen
                </Label>
                <p className="text-base text-warmgray-700 mb-3">
                  Das ist optional &ndash; Sie k&ouml;nnen hier eine kurze Nachricht hinterlassen.
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

            {/* Section 2: Ihre Ressourcen */}
            <div className="max-w-lg mx-auto">
              <h3 className="text-xl font-serif font-semibold text-warmgray-900 mb-4">
                Ihre Ressourcen
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center">
                    <Printer className="w-5 h-5 text-sage-700" />
                  </div>
                  <PrintGuideButton
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onPrint={() => capture('onboarding_step_printed', { step: 'complete', type: 'guide' })}
                  />
                </div>
                <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-sage-700" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEmailInstructions}
                    disabled={emailSent || isSendingEmail}
                    className="w-full"
                  >
                    {isSendingEmail ? (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    ) : emailSent ? (
                      <Check className="mr-2 w-4 h-4" />
                    ) : (
                      <Mail className="mr-2 w-4 h-4" />
                    )}
                    {emailSent ? 'Gesendet' : 'Per E-Mail senden'}
                  </Button>
                  {emailSent && userEmail && (
                    <p className="text-xs text-sage-700">An {userEmail}</p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-white border-2 border-warmgray-300 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center">
                    <Download className="w-5 h-5 text-sage-700" />
                  </div>
                  <DownloadChecklistButton
                    userName={userFullName || profileForm.full_name}
                    userEmail={userEmail}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onDownload={() => capture('onboarding_checklist_downloaded')}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: QR Code for Help Center */}
            {helpQrDataUrl && (
              <div className="max-w-md mx-auto">
                <div className="p-4 rounded-lg bg-sage-50 border-2 border-sage-200">
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-lg shadow-sm border border-warmgray-200 flex-shrink-0">
                      <img
                        src={helpQrDataUrl}
                        alt="QR-Code zu Video-Tutorials und Hilfeseite"
                        className="w-24 h-24"
                      />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-warmgray-900 mb-1">
                        Hilfe &amp; Video-Tutorials
                      </p>
                      <p className="text-sm text-warmgray-700">
                        Scannen Sie diesen Code mit Ihrer Handy-Kamera f&uuml;r Video-Tutorials und Hilfe.
                      </p>
                      <a
                        href="/hilfe#video-tutorials"
                        className="text-sm text-sage-700 hover:text-sage-800 underline inline-flex items-center gap-1 mt-1"
                      >
                        Hilfezentrum &amp; Tutorials öffnen
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: N&auml;chste Schritte */}
            <div className="max-w-lg mx-auto">
              <h3 className="text-xl font-serif font-semibold text-warmgray-900 mb-4">
                N&auml;chste Schritte
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    completeOnboarding()
                    router.push('/dokumente')
                  }}
                  className="p-4 rounded-lg bg-white border-2 border-warmgray-300 text-left hover:border-sage-400 hover:bg-sage-50 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4"
                >
                  <FileText className="w-6 h-6 text-sage-700 mb-2" />
                  <p className="font-medium text-warmgray-900">Dokumente hochladen</p>
                  <p className="text-sm text-warmgray-700">Personalausweis, Versicherungen</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    completeOnboarding()
                    router.push('/zugriff')
                  }}
                  className="p-4 rounded-lg bg-white border-2 border-warmgray-300 text-left hover:border-sage-400 hover:bg-sage-50 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4"
                >
                  <Users className="w-6 h-6 text-sage-700 mb-2" />
                  <p className="font-medium text-warmgray-900">Vertrauensperson einladen</p>
                  <p className="text-sm text-warmgray-700">Zugriff im Notfall</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    completeOnboarding()
                    router.push('/einstellungen')
                  }}
                  className="p-4 rounded-lg bg-white border-2 border-warmgray-300 text-left hover:border-sage-400 hover:bg-sage-50 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4"
                >
                  <HeartPulse className="w-6 h-6 text-sage-700 mb-2" />
                  <p className="font-medium text-warmgray-900">Profil vervollst&auml;ndigen</p>
                  <p className="text-sm text-warmgray-700">Medizinische Daten erg&auml;nzen</p>
                </button>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                size="onboarding"
                className="min-w-[160px]"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Zur&uuml;ck
              </Button>
              <Button
                onClick={completeOnboarding}
                disabled={isSaving}
                size="onboarding"
                className="min-w-[160px]"
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

  // Calculate sub-progress for profile and emergency steps
  const showFieldProgress = currentStep === 'profile' || (currentStep === 'emergency' && !skippedEmergency)
  const fieldProgressIndex = currentStep === 'profile' ? profileFieldIndex : emergencyFieldIndex
  const fieldProgressTotal = currentStep === 'profile' ? activeProfileFields.length : EMERGENCY_FIELDS.length

  return (
    <div className="min-h-screen bg-cream-50 py-8 px-4">
      {/* Resume Dialog */}
      {showResumeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card
            className="max-w-md w-full border-2 border-warmgray-300 shadow-md"
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
                  <Button onClick={resumeProgress} size="onboarding" className="flex-1">
                    Fortsetzen
                  </Button>
                  <Button variant="outline" onClick={startFresh} size="onboarding" className="flex-1">
                    Neu beginnen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skip Confirmation Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">
              Schritt überspringen?
            </DialogTitle>
            <DialogDescription className="text-lg leading-relaxed text-warmgray-700 pt-2">
              {skipDialogStep === 'profile'
                ? 'Ihre persönlichen Daten helfen uns, Ihnen besser zu dienen. Möchten Sie wirklich überspringen?'
                : 'Ein Notfallkontakt ist wichtig für Ihre Sicherheit. Ohne Kontakt können Vertrauenspersonen im Notfall nicht benachrichtigt werden.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => setShowSkipDialog(false)}
              size="onboarding"
              className="min-h-[44px] flex-1"
            >
              Zurück zum Formular
            </Button>
            <Button
              variant="destructive"
              onClick={confirmSkip}
              size="onboarding"
              className="min-h-[44px] flex-1"
            >
              Trotzdem überspringen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-2xl mx-auto">
        <div aria-live="polite" className="sr-only">
          Schritt {currentStepIndex + 1}: {STEPS[currentStepIndex].title}
          {showFieldProgress && `, Feld ${fieldProgressIndex + 1} von ${fieldProgressTotal}`}
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

          {/* Sub-progress for field-level steps */}
          {showFieldProgress && (
            <div className="mt-3 max-w-md mx-auto">
              <div className="flex justify-between text-sm text-sage-600 mb-1">
                <span>Feld {fieldProgressIndex + 1} von {fieldProgressTotal}</span>
              </div>
              <Progress value={((fieldProgressIndex + 1) / fieldProgressTotal) * 100} className="h-2" />
            </div>
          )}
        </div>

        {/* Step Content */}
        <Card className="border-2 border-warmgray-300 shadow-md">
          <CardContent className="pt-10 pb-10 px-8">
            <div ref={stepContentRef}>{renderStep()}</div>
            <p className="hidden md:block text-center text-sm text-warmgray-600 mt-6">
              Tastatur-Hilfe: Enter = Weiter, Esc = Später
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Step Feedback Widget */}
      <StepFeedbackWidget
        stepName={feedbackStep}
        timeSpentSeconds={getStepTimeSpent(feedbackStep)}
        onSubmit={handleFeedbackSubmit}
        onSkip={handleFeedbackSkip}
        open={showFeedbackWidget}
      />

      {/* Exit Survey Dialog */}
      <Dialog open={showExitSurvey} onOpenChange={setShowExitSurvey}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">
              Warum m&ouml;chten Sie sp&auml;ter weitermachen?
            </DialogTitle>
            <DialogDescription className="text-lg leading-relaxed text-warmgray-700 pt-2">
              Ihre R&uuml;ckmeldung hilft uns, die Einrichtung zu verbessern.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4" role="radiogroup" aria-label="Grund f&uuml;r das Abbrechen">
            {[
              { value: 'too_complicated', label: 'Zu kompliziert' },
              { value: 'need_more_time', label: 'Brauche mehr Zeit' },
              { value: 'not_sure_what_to_enter', label: 'Nicht sicher, was ich eingeben soll' },
              { value: 'other', label: 'Andere Gr\u00fcnde' },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors
                  ${exitReason === option.value
                    ? 'border-sage-600 bg-sage-50'
                    : 'border-warmgray-300 hover:border-warmgray-400'
                  }
                `}
              >
                <input
                  type="radio"
                  name="exit-reason"
                  value={option.value}
                  checked={exitReason === option.value}
                  onChange={(e) => setExitReason(e.target.value)}
                  className="w-5 h-5 text-sage-600 focus:ring-sage-500"
                />
                <span className="text-lg text-warmgray-900">{option.label}</span>
              </label>
            ))}
          </div>

          <div>
            <label htmlFor="exit-comments" className="block text-lg font-medium text-warmgray-900 mb-2">
              M&ouml;chten Sie uns mehr erz&auml;hlen?
            </label>
            <textarea
              id="exit-comments"
              value={exitComments}
              onChange={(e) => setExitComments(e.target.value)}
              placeholder="Optional: Ihre Anmerkungen..."
              className="w-full min-h-[80px] rounded-md border-2 border-warmgray-300 bg-white px-4 py-3 text-lg text-gray-900 transition-colors placeholder:text-warmgray-500 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-[3px] focus-visible:ring-sage-100 focus-visible:ring-offset-4"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleExitSurveySubmit}
              size="onboarding"
              className="min-h-[44px] flex-1"
            >
              Absenden und sp&auml;ter weitermachen
            </Button>
            <Button
              variant="outline"
              onClick={handleExitSurveyCancel}
              size="onboarding"
              className="min-h-[44px] flex-1"
            >
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FloatingHelpButton currentStep={currentStep} />
    </div>
  )
}
