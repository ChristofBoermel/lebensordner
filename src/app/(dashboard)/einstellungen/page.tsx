'use client'

import { useState, useEffect, useCallback } from 'react'
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
  X
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { TwoFactorSetup } from '@/components/auth/two-factor-setup'
import type { Profile } from '@/types/database'

export default function EinstellungenPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const router = useRouter()
  const supabase = createClient()

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

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/anmelden')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      setProfile(data)
      setIs2FAEnabled(data.two_factor_enabled || false)
    }
    setIsLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          date_of_birth: profile.date_of_birth,
          address: profile.address,
          onboarding_completed: true,
          email_reminders_enabled: profile.email_reminders_enabled ?? true,
          email_reminder_days_before: profile.email_reminder_days_before ?? 7,
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

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      'Sind Sie sicher, dass Sie Ihr Konto löschen möchten? ' +
      'Alle Ihre Daten werden unwiderruflich gelöscht. ' +
      'Diese Aktion kann nicht rückgängig gemacht werden.'
    )

    if (!confirmed) return

    const doubleConfirmed = confirm(
      'Letzte Warnung: Möchten Sie wirklich Ihr Konto und alle Daten dauerhaft löschen?'
    )

    if (!doubleConfirmed) return

    setIsDeletingAccount(true)
    setError(null)

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Löschen')
      }

      // Redirect to home page
      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Kontos. Bitte kontaktieren Sie den Support.')
      console.error('Delete error:', err)
    } finally {
      setIsDeletingAccount(false)
    }
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

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // Delete old picture if exists
      if (profile.profile_picture_url) {
        const oldPath = profile.profile_picture_url.split('/').slice(-2).join('/')
        await supabase.storage.from('avatars').remove([oldPath])
      }

      // Upload new picture
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

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
      setError('Fehler beim Hochladen des Bildes')
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Einstellungen
        </h1>
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
            <div className="flex items-center gap-4">
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
                  value={profile.email_reminder_days_before ?? 7}
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
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-warmgray-900">Design</p>
              <p className="text-sm text-warmgray-500">
                Wählen Sie zwischen Hell, Dunkel oder System
              </p>
            </div>
            <ThemeToggle />
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

          <Separator />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-red-600">Konto löschen</p>
              <p className="text-sm text-warmgray-500">
                Ihr Konto und alle Daten unwiderruflich löschen
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleDeleteAccount}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Konto löschen
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
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-warmgray-900">
                {((profile.storage_used || 0) / (1024 * 1024)).toFixed(1)} MB verwendet
              </p>
              <p className="text-sm text-warmgray-500">
                von 2 GB verfügbar
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-sage-600">
                {(((profile.storage_used || 0) / (2 * 1024 * 1024 * 1024)) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-warmgray-100">
            <div 
              className="h-full rounded-full bg-sage-500 transition-all"
              style={{ width: `${Math.min(((profile.storage_used || 0) / (2 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
            />
          </div>
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
    </div>
  )
}
