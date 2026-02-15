'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Trash2,
  Bell,
  Key,
  Lock,
  Shield,
  Smartphone,
  RotateCcw,
  Sparkles,
  Camera,
  X,
  ChevronLeft,
  CreditCard,
  Settings,
  ArrowRight,
  History,
  Eye,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { useTheme } from '@/components/theme/theme-provider'
import { TwoFactorSetup } from '@/components/auth/two-factor-setup'
import { DeleteAccountModal } from '@/components/settings/delete-account-modal'
import { SUBSCRIPTION_TIERS, getTierFromSubscription, type TierConfig } from '@/lib/subscription-tiers'
import type { Profile } from '@/types/database'
import type { ConsentRecord } from '@/lib/consent/manager'
import Cookies from 'js-cookie'
import { CONSENT_VERSION, CONSENT_COOKIE_NAME } from '@/lib/consent/constants'
import Link from 'next/link'
import { SecurityActivityLog } from '@/components/settings/security-activity-log'
import { GDPRExportDialog } from '@/components/settings/gdpr-export-dialog'
import { HealthConsentWithdrawalDialog } from '@/components/settings/health-consent-withdrawal-dialog'

type SeniorSection = 'profil' | 'sicherheit' | 'zahlung' | 'weitere' | null

export default function EinstellungenPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Senior mode section navigation
  const [seniorActiveSection, setSeniorActiveSection] = useState<SeniorSection>(null)

  // 2FA state
  const [is2FADialogOpen, setIs2FADialogOpen] = useState(false)
  const [is2FAEnabled, setIs2FAEnabled] = useState(false)

  // Password change state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Profile picture state
  const [isUploadingPicture, setIsUploadingPicture] = useState(false)

  // Account deletion state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Privacy & consent state
  const [analyticsConsent, setAnalyticsConsent] = useState(false)
  const [healthDataConsent, setHealthDataConsent] = useState(false)
  const [showHealthWithdrawalDialog, setShowHealthWithdrawalDialog] = useState(false)
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([])
  const [showConsentHistory, setShowConsentHistory] = useState(false)
  const [isLoadingConsent, setIsLoadingConsent] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)
  const supabase = useMemo(() => createClient(), [])
  const { seniorMode, setSeniorMode } = useTheme()
  const profileVersion = (globalThis as typeof globalThis & { __PROFILE_VERSION__?: number }).__PROFILE_VERSION__ ?? 0

  useEffect(() => {
    routerRef.current = router
  }, [router])

  const handlePasswordChange = async () => {
    setPasswordError(null)
    setPasswordSuccess(false)

    // First verify old password is provided
    if (!currentPassword) {
      setPasswordError('Bitte geben Sie Ihr aktuelles Passwort ein.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Die neuen Passwörter stimmen nicht überein.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Das neue Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }

    setIsChangingPassword(true)

    try {
      // First, verify the current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        throw new Error('Benutzer nicht gefunden')
      }

      // Re-authenticate with current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })

      if (signInError) {
        setPasswordError('Das aktuelle Passwort ist nicht korrekt.')
        setIsChangingPassword(false)
        return
      }

      // Now update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      // Send security notification for password change
      fetch('/api/auth/security-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'password_changed' }),
      }).catch(() => {
        // Don't block UI for notification failures
      })

      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')

      setTimeout(() => {
        setIsPasswordDialogOpen(false)
        setPasswordSuccess(false)
      }, 2000)
    } catch (err: any) {
      setPasswordError(err.message || 'Fehler beim Ändern des Passworts.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const loadHealthConsent = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('health_data_consent_granted')
      .eq('id', userId)
      .single()

    setHealthDataConsent(profileData?.health_data_consent_granted || false)
  }, [supabase])

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      routerRef.current.push('/anmelden')
      return
    }

    // Fetch non-PII profile data from Supabase
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    await loadHealthConsent(user.id)

    if (!error && data) {
      // Fetch decrypted PII from server API
      try {
        const piiResponse = await fetch('/api/profile')
        if (piiResponse.ok) {
          const { profile: piiData } = await piiResponse.json()
          const merged = { ...data, ...piiData }
          setProfile((prev) => {
            const prevJson = JSON.stringify(prev)
            const nextJson = JSON.stringify(merged)
            return prevJson === nextJson ? prev : merged
          })
        } else {
          setProfile((prev) => {
            const prevJson = JSON.stringify(prev)
            const nextJson = JSON.stringify(data)
            return prevJson === nextJson ? prev : data
          })
        }
      } catch {
        // Fallback to raw data if API fails
        setProfile((prev) => {
          const prevJson = JSON.stringify(prev)
          const nextJson = JSON.stringify(data)
          return prevJson === nextJson ? prev : data
        })
      }

      const nextIs2FAEnabled = data.two_factor_enabled || false
      setIs2FAEnabled((prev) => (prev === nextIs2FAEnabled ? prev : nextIs2FAEnabled))

      // Set user tier based on subscription
      const tier = getTierFromSubscription(data.subscription_status, data.stripe_price_id || null)
      setUserTier((prev) => (prev.id === tier.id ? prev : tier))
    }
    setIsLoading(false)
  }, [supabase, loadHealthConsent])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile, profileVersion])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // Save PII fields via encrypted API
      const piiResponse = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: profile.phone || null,
          address: profile.address || null,
          date_of_birth: profile.date_of_birth || null,
        }),
      })

      if (!piiResponse.ok) {
        throw new Error('Fehler beim Speichern der persönlichen Daten')
      }

      // Save non-PII fields directly
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          onboarding_completed: true,
          email_reminders_enabled: profile.email_reminders_enabled ?? true,
          email_reminder_days_before: profile.email_reminder_days_before ?? 30,
          sms_reminders_enabled: profile.sms_reminders_enabled ?? false,
          sms_reminder_days_before: profile.sms_reminder_days_before ?? 3,
        })
        .eq('id', user.id)

      if (error) throw error

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleRestartOnboarding = async () => {
    const confirmed = confirm(
      'Möchten Sie die Einführung erneut durchlaufen? Sie werden zur Einrichtungsseite weitergeleitet.'
    )
    if (!confirmed) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      await supabase
        .from('profiles')
        .update({ onboarding_completed: false })
        .eq('id', user.id)

      router.push('/onboarding')
    } catch (err) {
      setError('Fehler beim Zurücksetzen. Bitte versuchen Sie es erneut.')
      console.error('Restart onboarding error:', err)
    }
  }

  const handleAccountDeleted = () => {
    router.push('/')
    router.refresh()
  }

  // Profile picture upload
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Bitte wählen Sie ein Bild aus (JPG, PNG)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Das Bild darf maximal 5 MB groß sein')
      return
    }

    setIsUploadingPicture(true)
    setError(null)

    setIsUploadingPicture(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // 1. Upload via Server-Side API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', 'profile')
      formData.append('bucket', 'avatars')

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json()
        throw new Error(errorData.error || 'Upload fehlgeschlagen')
      }

      const uploadData = await uploadRes.json()
      const { path: filePath } = uploadData

      // Get public URL from the returned path
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile({ ...profile, profile_picture_url: publicUrl })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Hochladen des Bildes')
      console.error('Upload error:', err)
    } finally {
      setIsUploadingPicture(false)
    }
  }

  const handleRemoveProfilePicture = async () => {
    if (!profile.profile_picture_url) return

    setIsUploadingPicture(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // Delete from storage
      const filePath = profile.profile_picture_url.split('/').slice(-2).join('/')
      await supabase.storage.from('avatars').remove([filePath])

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: null })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile({ ...profile, profile_picture_url: null })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError('Fehler beim Entfernen des Bildes')
      console.error('Remove error:', err)
    } finally {
      setIsUploadingPicture(false)
    }
  }

  // Fetch consent state on mount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const fetchConsent = async () => {
      try {
        // Read current state from cookie first
        const consentCookie = Cookies.get(CONSENT_COOKIE_NAME)
        if (consentCookie) {
          const parsed = JSON.parse(consentCookie)
          setAnalyticsConsent(parsed.analytics === true)
        }

        // Fetch history from server
        const res = await fetch('/api/consent/history')
        if (res.ok) {
          const data = await res.json()
          setConsentHistory(data.history || [])
          // Set analytics consent from latest server record if available
          const latestAnalytics = (data.history || []).find(
            (r: ConsentRecord) => r.consent_type === 'analytics'
          )
          if (latestAnalytics) {
            setAnalyticsConsent(latestAnalytics.granted)
          }
        }
      } catch {
        // Silently handle - consent state falls back to cookie
      }
    }
    fetchConsent()
  }, [])

  const handleAnalyticsConsentToggle = async (enabled: boolean) => {
    setAnalyticsConsent(enabled)
    setIsLoadingConsent(true)

    // Update cookie
    const consentCookie = Cookies.get(CONSENT_COOKIE_NAME)
    const current = consentCookie ? JSON.parse(consentCookie) : { necessary: true, analytics: false, marketing: false, version: CONSENT_VERSION }
    const updated = { ...current, analytics: enabled }
    Cookies.set(CONSENT_COOKIE_NAME, JSON.stringify(updated), { expires: 365, sameSite: 'strict' })

    // Note: PostHog initialization is handled by PostHogProvider
    // which monitors cookie changes and initializes/opts-out accordingly

    // Record to server
    try {
      await fetch('/api/consent/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentType: 'analytics',
          granted: enabled,
          version: updated.version || CONSENT_VERSION,
        }),
      })
      // Refresh history
      const res = await fetch('/api/consent/history')
      if (res.ok) {
        const data = await res.json()
        setConsentHistory(data.history || [])
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoadingConsent(false)
    }
  }

  const handleViewConsentHistory = async () => {
    setShowConsentHistory(true)
    try {
      const res = await fetch('/api/consent/history')
      if (res.ok) {
        const data = await res.json()
        setConsentHistory(data.history || [])
      }
    } catch {
      // Silently handle
    }
  }

  const handleHealthConsentToggle = (checked: boolean) => {
    if (!checked) {
      setShowHealthWithdrawalDialog(true)
    } else {
      setHealthDataConsent(true)
      router.push('/notfall')
    }
  }

  const handleHealthConsentWithdrawn = () => {
    setHealthDataConsent(false)
    setShowHealthWithdrawalDialog(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  // Senior Mode Card Navigation
  const renderSeniorCards = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Einstellungen
        </h1>
      </div>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="p-4 rounded-lg bg-sage-50 border border-sage-200 text-sage-700 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          Ihre Änderungen wurden gespeichert.
        </div>
      )}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:border-sage-400 hover:shadow-md transition-all"
          onClick={() => setSeniorActiveSection('profil')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center">
                <User className="w-7 h-7 text-sage-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg text-warmgray-900">Meine Daten</p>
                <p className="text-sm text-warmgray-500">Name, Adresse, Telefon</p>
              </div>
              <ArrowRight className="w-5 h-5 text-warmgray-400" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-sage-400 hover:shadow-md transition-all"
          onClick={() => setSeniorActiveSection('sicherheit')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center">
                <Lock className="w-7 h-7 text-sage-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg text-warmgray-900">Sicherheit</p>
                <p className="text-sm text-warmgray-500">Passwort, 2FA</p>
              </div>
              <ArrowRight className="w-5 h-5 text-warmgray-400" />
            </div>
          </CardContent>
        </Card>

        <Link href="/abo" className="block">
          <Card className="cursor-pointer hover:border-sage-400 hover:shadow-md transition-all h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center">
                  <CreditCard className="w-7 h-7 text-sage-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg text-warmgray-900">Zahlung & Tarif</p>
                  <p className="text-sm text-warmgray-500">{userTier.name}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-warmgray-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card
          className="cursor-pointer hover:border-sage-400 hover:shadow-md transition-all"
          onClick={() => setSeniorActiveSection('weitere')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center">
                <Settings className="w-7 h-7 text-sage-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg text-warmgray-900">Weitere Einstellungen</p>
                <p className="text-sm text-warmgray-500">Benachrichtigungen, Design</p>
              </div>
              <ArrowRight className="w-5 h-5 text-warmgray-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // Senior Mode Section Header with Back Button
  const renderSeniorSectionHeader = (title: string) => (
    <div className="flex items-center gap-4 mb-6">
      <Button
        variant="ghost"
        size="lg"
        onClick={() => setSeniorActiveSection(null)}
        className="gap-2"
      >
        <ChevronLeft className="w-5 h-5" />
        Zurück
      </Button>
      <h1 className="text-2xl font-serif font-semibold text-warmgray-900">{title}</h1>
    </div>
  )

  // Senior Mode: Show cards or specific section
  if (seniorMode) {
    // Show section navigation cards
    if (seniorActiveSection === null) {
      return renderSeniorCards()
    }

    // Show specific section
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success/Error Messages */}
        {saveSuccess && (
          <div className="p-4 rounded-lg bg-sage-50 border border-sage-200 text-sage-700 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            Ihre Änderungen wurden gespeichert.
          </div>
        )}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {seniorActiveSection === 'profil' && (
          <>
            {renderSeniorSectionHeader('Meine Daten')}
            {/* Profile Card - same as below */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Profile Picture */}
                <div className="space-y-2">
                  <Label>Profilbild</Label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative">
                      {profile.profile_picture_url ? (
                        <img src={profile.profile_picture_url} alt="Profilbild" className="w-20 h-20 rounded-full object-cover border-2 border-warmgray-200" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-sage-100 flex items-center justify-center border-2 border-warmgray-200">
                          <User className="w-8 h-8 text-sage-600" />
                        </div>
                      )}
                      {isUploadingPicture && (
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfilePictureUpload} className="hidden" disabled={isUploadingPicture} />
                        <Button variant="outline" size="sm" asChild disabled={isUploadingPicture}>
                          <span><Camera className="w-4 h-4 mr-2" />{profile.profile_picture_url ? 'Ändern' : 'Hochladen'}</span>
                        </Button>
                      </label>
                      {profile.profile_picture_url && (
                        <Button variant="ghost" size="sm" onClick={handleRemoveProfilePicture} disabled={isUploadingPicture} className="text-red-600 hover:bg-red-50">
                          <X className="w-4 h-4 mr-2" />Entfernen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="full_name">Vollständiger Name</Label>
                  <Input id="full_name" value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Max Mustermann" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input id="email" type="email" value={profile.email || ''} disabled className="bg-warmgray-50" />
                  <p className="text-xs text-warmgray-500">Die E-Mail-Adresse kann nicht geändert werden</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefonnummer</Label>
                  <Input id="phone" type="tel" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+49 123 456789" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Geburtsdatum</Label>
                  <Input id="date_of_birth" type="date" value={profile.date_of_birth || ''} onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <textarea id="address" value={profile.address || ''} onChange={(e) => setProfile({ ...profile, address: e.target.value })} placeholder="Musterstraße 1&#10;12345 Musterstadt" className="w-full min-h-[100px] rounded-md border-2 border-warmgray-400 bg-white px-4 py-3 text-base" />
                </div>
                <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full">
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Speichern...</> : <><Save className="mr-2 h-4 w-4" />Änderungen speichern</>}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {seniorActiveSection === 'sicherheit' && (
          <>
            {renderSeniorSectionHeader('Sicherheit')}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-warmgray-900">Passwort ändern</p>
                    <p className="text-sm text-warmgray-500">Ändern Sie Ihr Anmeldepasswort</p>
                  </div>
                  <Button variant="outline" size="lg" onClick={() => setIsPasswordDialogOpen(true)}>
                    <Key className="mr-2 h-4 w-4" />Ändern
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-warmgray-900">Zwei-Faktor-Authentifizierung</p>
                      {is2FAEnabled && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Aktiv</span>}
                    </div>
                    <p className="text-sm text-warmgray-500">{is2FAEnabled ? 'Ihr Konto ist durch 2FA geschützt' : 'Zusätzliche Sicherheit'}</p>
                  </div>
                  <Button variant={is2FAEnabled ? "outline" : "default"} size="lg" onClick={() => setIs2FADialogOpen(true)}>
                    <Smartphone className="mr-2 h-4 w-4" />{is2FAEnabled ? 'Verwalten' : 'Aktivieren'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {seniorActiveSection === 'weitere' && (
          <>
            {renderSeniorSectionHeader('Weitere Einstellungen')}
            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-sage-600" />Benachrichtigungen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-warmgray-900">Erinnerungs-E-Mails</p>
                    <p className="text-sm text-warmgray-500">E-Mails vor Fälligkeitsdaten</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={profile.email_reminders_enabled ?? true} onChange={(e) => setProfile({ ...profile, email_reminders_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-warmgray-200 peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-warmgray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-600"></div>
                  </label>
                </div>
              </CardContent>
            </Card>
            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle>Erscheinungsbild</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-warmgray-900">Design</p>
                    <p className="text-sm text-warmgray-500">Hell, Dunkel oder System</p>
                  </div>
                  <ThemeToggle />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-warmgray-900">Einfache Ansicht</p>
                    <p className="text-sm text-warmgray-500">Größere Schrift und Bedienelemente</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={seniorMode} onChange={(e) => setSeniorMode(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-warmgray-200 peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-warmgray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-600"></div>
                  </label>
                </div>
              </CardContent>
            </Card>
            {/* Account */}
            <Card>
              <CardHeader>
                <CardTitle>Konto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-warmgray-900">Einführung wiederholen</p>
                    <p className="text-sm text-warmgray-500">Die Ersteinrichtung erneut durchlaufen</p>
                  </div>
                  <Button variant="outline" size="lg" onClick={handleRestartOnboarding}>
                    <Sparkles className="mr-2 h-4 w-4" />Wiederholen
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-warmgray-900">Abmelden</p>
                    <p className="text-sm text-warmgray-500">Von diesem Gerät abmelden</p>
                  </div>
                  <Button variant="outline" size="lg" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />Abmelden
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-red-600">Konto löschen</p>
                    <p className="text-sm text-warmgray-500">Ihr Konto und alle Daten unwiderruflich löschen</p>
                  </div>
                  <Button variant="outline" size="lg" onClick={() => setIsDeleteDialogOpen(true)} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="mr-2 h-4 w-4" />Konto löschen
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Speichern...</> : <><Save className="mr-2 h-4 w-4" />Änderungen speichern</>}
            </Button>
          </>
        )}

        {/* Dialogs - must be included */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Passwort ändern</DialogTitle>
              <DialogDescription>Geben Sie zuerst Ihr aktuelles Passwort ein, dann das neue Passwort.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {passwordError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{passwordError}</div>}
              {passwordSuccess && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Passwort erfolgreich geändert!</div>}
              <div className="space-y-2"><Label htmlFor="current_password">Aktuelles Passwort *</Label><Input id="current_password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
              <Separator />
              <div className="space-y-2"><Label htmlFor="new_password">Neues Passwort *</Label><Input id="new_password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mindestens 8 Zeichen" /></div>
              <div className="space-y-2"><Label htmlFor="confirm_new_password">Neues Passwort bestätigen *</Label><Input id="confirm_new_password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handlePasswordChange} disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}>
                {isChangingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Überprüfen...</> : 'Passwort ändern'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <TwoFactorSetup isOpen={is2FADialogOpen} onClose={() => setIs2FADialogOpen(false)} isEnabled={is2FAEnabled} onStatusChange={setIs2FAEnabled} />
        <DeleteAccountModal open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onDeleted={handleAccountDeleted} />
      </div>
    )
  }

  // Normal View
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
            Einstellungen
          </h1>
          <span className="rounded-full bg-sage-100 px-3 py-1 text-sm font-semibold text-sage-700">
            {userTier.name}
          </span>
        </div>
        <p className="text-lg text-warmgray-600 mt-2">
          Verwalten Sie Ihr Profil und Ihre Kontoeinstellungen
        </p>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="p-4 rounded-lg bg-sage-50 border border-sage-200 text-sage-700 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          Ihre Änderungen wurden gespeichert.
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-sage-600" />
            Persönliche Daten
          </CardTitle>
          <CardDescription>
            Diese Informationen helfen Ihren Vertrauenspersonen im Notfall
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="space-y-2">
            <Label>Profilbild</Label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative">
                {profile.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url}
                    alt="Profilbild"
                    className="w-20 h-20 rounded-full object-cover border-2 border-warmgray-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-sage-100 flex items-center justify-center border-2 border-warmgray-200">
                    <User className="w-8 h-8 text-sage-600" />
                  </div>
                )}
                {isUploadingPicture && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleProfilePictureUpload}
                    className="hidden"
                    disabled={isUploadingPicture}
                  />
                  <Button variant="outline" size="sm" asChild disabled={isUploadingPicture}>
                    <span>
                      <Camera className="w-4 h-4 mr-2" />
                      {profile.profile_picture_url ? 'Ändern' : 'Hochladen'}
                    </span>
                  </Button>
                </label>
                {profile.profile_picture_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveProfilePicture}
                    disabled={isUploadingPicture}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Entfernen
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-warmgray-500">JPG, PNG oder WebP, max. 5 MB</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="full_name">Vollständiger Name</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-500" />
              <Input
                id="full_name"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Max Mustermann"
                className="pl-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail-Adresse</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-500" />
              <Input
                id="email"
                type="email"
                value={profile.email || ''}
                disabled
                className="pl-12 bg-warmgray-50"
              />
            </div>
            <p className="text-xs text-warmgray-500">
              Die E-Mail-Adresse kann nicht geändert werden
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefonnummer</Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-500" />
              <Input
                id="phone"
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+49 123 456789"
                className="pl-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Geburtsdatum</Label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-500" />
              <Input
                id="date_of_birth"
                type="date"
                value={profile.date_of_birth || ''}
                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                className="pl-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <div className="relative">
              <MapPin className="absolute left-4 top-4 w-5 h-5 text-warmgray-500" />
              <textarea
                id="address"
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Musterstraße 1&#10;12345 Musterstadt"
                className="w-full min-h-[100px] rounded-md border-2 border-warmgray-400 bg-white pl-12 pr-4 py-3 text-base text-gray-900 transition-colors placeholder:text-warmgray-500 focus-visible:outline-none focus-visible:border-sage-400 focus-visible:ring-2 focus-visible:ring-sage-100"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Speichern...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Änderungen speichern
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-sage-600" />
            E-Mail-Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Lassen Sie sich per E-Mail an wichtige Fristen erinnern
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Erinnerungs-E-Mails</p>
              <p className="text-sm text-warmgray-500">
                Erhalten Sie E-Mails vor Fälligkeitsdaten
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={profile.email_reminders_enabled ?? true}
                onChange={(e) => setProfile({ ...profile, email_reminders_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-warmgray-200 peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-warmgray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-600"></div>
            </label>
          </div>

          {profile.email_reminders_enabled && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="reminder_days">Erinnerung senden vor Fälligkeit</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="reminder_days"
                  type="number"
                  min="1"
                  max="30"
                  value={profile.email_reminder_days_before ?? 30}
                  onChange={(e) => setProfile({ ...profile, email_reminder_days_before: parseInt(e.target.value) || 7 })}
                  className="w-24"
                />
                <span className="text-warmgray-600">Tage</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sage-600" />
            SMS-Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Lassen Sie sich per SMS an wichtige Fristen erinnern
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Erinnerungs-SMS</p>
              <p className="text-sm text-warmgray-500">
                Erhalten Sie SMS vor Fälligkeitsdaten
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={profile.sms_reminders_enabled ?? false}
                onChange={(e) => setProfile({ ...profile, sms_reminders_enabled: e.target.checked })}
                disabled={!profile.phone}
                className="sr-only peer"
              />
              <div className={cn(
                "w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-warmgray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
                !profile.phone
                  ? "bg-warmgray-100 cursor-not-allowed"
                  : "bg-warmgray-200 peer-focus:ring-2 peer-focus:ring-sage-300 peer-checked:bg-sage-600"
              )}></div>
            </label>
          </div>

          {!profile.phone && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Bitte geben Sie eine Telefonnummer in Ihren persönlichen Daten ein, um SMS-Benachrichtigungen zu aktivieren.
            </div>
          )}

          {profile.sms_reminders_enabled && profile.phone && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="sms_reminder_days">SMS-Erinnerung senden vor Fälligkeit</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="sms_reminder_days"
                  type="number"
                  min="1"
                  max="14"
                  value={profile.sms_reminder_days_before ?? 3}
                  onChange={(e) => setProfile({ ...profile, sms_reminder_days_before: parseInt(e.target.value) || 3 })}
                  className="w-24"
                />
                <span className="text-warmgray-600">Tage</span>
              </div>
              <p className="text-xs text-warmgray-500">
                SMS-Benachrichtigungen sind auf 1-14 Tage vor Fälligkeit begrenzt.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Activity */}
      <SecurityActivityLog />

      {/* Privacy & Data */}
      <Card id="privacy">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sage-600" />
            Datenschutz & Privatsphäre
          </CardTitle>
          <CardDescription>
            Verwalten Sie Ihre Einwilligungen und Rechte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-warmgray-500">
            Einwilligungen
          </p>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Analyse-Cookies</p>
              <p className="text-sm text-warmgray-500">
                Helfen uns, die Website zu verbessern (PostHog)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={analyticsConsent}
                onChange={(e) => handleAnalyticsConsentToggle(e.target.checked)}
                disabled={isLoadingConsent}
                className="sr-only peer"
              />
              <div className={cn(
                "w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-warmgray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
                isLoadingConsent
                  ? "bg-warmgray-100 cursor-not-allowed"
                  : "bg-warmgray-200 peer-focus:ring-2 peer-focus:ring-sage-300 peer-checked:bg-sage-600"
              )}></div>
            </label>
          </div>

          <Separator />

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-warmgray-900">Gesundheitsdaten-Einwilligung</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 ml-2">
                  Art. 9 DSGVO
                </span>
              </div>
              <p className="text-sm text-warmgray-500">
                Verarbeitung von medizinischen Daten für Notfallzugriff
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={healthDataConsent}
                onChange={(e) => handleHealthConsentToggle(e.target.checked)}
                disabled={isLoadingConsent}
                data-testid="health-consent-toggle"
                className="sr-only peer"
              />
              <div className={cn(
                "w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-warmgray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
                isLoadingConsent
                  ? "bg-warmgray-100 cursor-not-allowed"
                  : "bg-warmgray-200 peer-focus:ring-2 peer-focus:ring-sage-300 peer-checked:bg-sage-600"
              )}></div>
            </label>
          </div>

          <Separator />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Einwilligungsverlauf</p>
              <p className="text-sm text-warmgray-500">
                Alle Änderungen Ihrer Datenschutzeinstellungen einsehen
              </p>
            </div>
            <Button variant="outline" onClick={handleViewConsentHistory}>
              <History className="mr-2 h-4 w-4" />
              Verlauf
            </Button>
          </div>

          <Separator />

          <div className="py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-warmgray-500">
              Ihre Daten
            </p>
            <div className="flex items-center gap-2 mt-3">
              <p className="font-medium text-warmgray-900">GDPR-Datenexport</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 ml-2">
                Art. 20 DSGVO
              </span>
            </div>
            <p className="text-sm text-warmgray-500 mb-3">
              Laden Sie alle Ihre Daten als JSON-Datei herunter
            </p>
            <GDPRExportDialog />
          </div>

          <Separator />

          <p className="text-xs font-semibold uppercase tracking-wide text-warmgray-500">
            Ihre Rechte
          </p>

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-warmgray-900">Datenverarbeitung einschränken</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 ml-2">
                  Art. 18 DSGVO
                </span>
              </div>
              <p className="text-sm text-warmgray-500">
                Antrag auf Einschränkung der Verarbeitung stellen
              </p>
            </div>
            <a
              href="mailto:datenschutz@lebensordner.org?subject=Antrag%20auf%20Einschränkung%20der%20Datenverarbeitung&body=Sehr%20geehrtes%20Lebensordner-Team%2C%0A%0Ahiermit%20beantrage%20ich%20die%20Einschränkung%20der%20Verarbeitung%20meiner%20personenbezogenen%20Daten%20gemäß%20Art.%2018%20DSGVO.%0A%0AGrund%20für%20den%20Antrag%3A%0A%5B%20%5D%20Ich%20bestreite%20die%20Richtigkeit%20meiner%20Daten%0A%5B%20%5D%20Die%20Verarbeitung%20ist%20unrechtmäßig%0A%5B%20%5D%20Ich%20benötige%20die%20Daten%20für%20Rechtsansprüche%0A%5B%20%5D%20Ich%20habe%20Widerspruch%20eingelegt%20(Art.%2021)%0A%0AWeitere%20Informationen%3A%0A%5BBitte%20hier%20Details%20angeben%5D%0A%0AMit%20freundlichen%20Grüßen"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              Antrag stellen →
            </a>
          </div>

          <Separator />

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-warmgray-900">Konto löschen</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 ml-2">
                  Art. 17 DSGVO
                </span>
              </div>
              <p className="text-sm text-warmgray-500">
                Ihr Konto und alle Daten unwiderruflich löschen
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Konto löschen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-sage-600" />
            Sicherheit
          </CardTitle>
          <CardDescription>
            Passwort und Sicherheitseinstellungen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Passwort ändern</p>
              <p className="text-sm text-warmgray-500">
                Ändern Sie Ihr Anmeldepasswort
              </p>
            </div>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(true)}>
              <Key className="mr-2 h-4 w-4" />
              Ändern
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-warmgray-900">Zwei-Faktor-Authentifizierung</p>
                {is2FAEnabled && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    Aktiv
                  </span>
                )}
              </div>
              <p className="text-sm text-warmgray-500">
                {is2FAEnabled
                  ? 'Ihr Konto ist durch 2FA geschützt'
                  : 'Zusätzliche Sicherheit mit Authenticator-App'
                }
              </p>
            </div>
            <Button
              variant={is2FAEnabled ? "outline" : "default"}
              onClick={() => setIs2FADialogOpen(true)}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              {is2FAEnabled ? 'Verwalten' : 'Aktivieren'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Erscheinungsbild</CardTitle>
          <CardDescription>
            Passen Sie das Design der Anwendung an
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Einfache Ansicht</p>
              <p className="text-sm text-warmgray-500">
                Größere Schrift und Bedienelemente
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={seniorMode}
                onChange={(e) => setSeniorMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-warmgray-200 peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-warmgray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-600"></div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
          <CardDescription>
            Kontoaktionen und Sicherheitseinstellungen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Einführung wiederholen</p>
              <p className="text-sm text-warmgray-500">
                Die Ersteinrichtung erneut durchlaufen
              </p>
            </div>
            <Button variant="outline" onClick={handleRestartOnboarding}>
              <Sparkles className="mr-2 h-4 w-4" />
              Wiederholen
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Abmelden</p>
              <p className="text-sm text-warmgray-500">
                Von diesem Gerät abmelden
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Info */}
      <Card>
        <CardHeader>
          <CardTitle>Speicherplatz</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const storageUsedMB = (profile.storage_used || 0) / (1024 * 1024)
            const maxStorageMB = userTier.limits.maxStorageMB
            const maxStorageDisplay = maxStorageMB >= 1024
              ? `${(maxStorageMB / 1024).toFixed(0)} GB`
              : `${maxStorageMB} MB`
            const usagePercent = (storageUsedMB / maxStorageMB) * 100
            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-warmgray-900">
                      {storageUsedMB.toFixed(1)} MB verwendet
                    </p>
                    <p className="text-sm text-warmgray-500">
                      von {maxStorageDisplay} verfügbar ({userTier.name})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-sage-600">
                      {usagePercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-warmgray-100">
                  <div
                    className="h-full rounded-full bg-sage-500 transition-all"
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                {userTier.id !== 'premium' && (
                  <div className="mt-4 rounded-lg border border-sage-200 bg-sage-50 p-3 text-sm text-sage-700">
                    <div className="flex items-center justify-between gap-3">
                      <span>Mehr Speicherplatz und Funktionen freischalten.</span>
                      <Link href="/abo" className="underline">
                        Upgrade
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort ändern</DialogTitle>
            <DialogDescription>
              Geben Sie zuerst Ihr aktuelles Passwort ein, dann das neue Passwort.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {passwordError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Passwort erfolgreich geändert!
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="current_password">Aktuelles Passwort *</Label>
              <Input
                id="current_password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ihr aktuelles Passwort"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="new_password">Neues Passwort *</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_new_password">Neues Passwort bestätigen *</Label>
              <Input
                id="confirm_new_password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Passwort wiederholen"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Überprüfen...
                </>
              ) : (
                'Passwort ändern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <TwoFactorSetup
        isOpen={is2FADialogOpen}
        onClose={() => setIs2FADialogOpen(false)}
        isEnabled={is2FAEnabled}
        onStatusChange={setIs2FAEnabled}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={handleAccountDeleted}
      />

      {/* Health Consent Withdrawal Dialog */}
      <HealthConsentWithdrawalDialog
        open={showHealthWithdrawalDialog}
        onOpenChange={setShowHealthWithdrawalDialog}
        onWithdrawn={handleHealthConsentWithdrawn}
      />

      {/* Consent History Dialog */}
      <Dialog open={showConsentHistory} onOpenChange={setShowConsentHistory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Einwilligungsverlauf</DialogTitle>
            <DialogDescription>
              Alle Änderungen Ihrer Datenschutzeinstellungen
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {consentHistory.length === 0 ? (
              <p className="text-sm text-warmgray-500 text-center py-4">
                Noch keine Einträge vorhanden.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-warmgray-200">
                      <th className="text-left py-2 px-2 font-medium text-warmgray-700">Typ</th>
                      <th className="text-left py-2 px-2 font-medium text-warmgray-700">Status</th>
                      <th className="text-left py-2 px-2 font-medium text-warmgray-700">Version</th>
                      <th className="text-left py-2 px-2 font-medium text-warmgray-700">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consentHistory.map((record) => (
                      <tr key={record.id} className="border-b border-warmgray-100">
                        <td className="py-2 px-2 text-warmgray-900">
                          {record.consent_type === 'analytics' ? 'Analyse' : 'Marketing'}
                        </td>
                        <td className="py-2 px-2">
                          <span className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-full",
                            record.granted
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}>
                            {record.granted ? 'Erlaubt' : 'Abgelehnt'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-warmgray-500">{record.version}</td>
                        <td className="py-2 px-2 text-warmgray-500">
                          {new Date(record.timestamp).toLocaleString('de-DE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsentHistory(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
