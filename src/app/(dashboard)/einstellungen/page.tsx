'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
  Trash2
} from 'lucide-react'
import type { Profile } from '@/types/database'

export default function EinstellungenPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

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

    try {
      // Note: In production, this would need a server-side function to properly delete
      // all user data and the auth account
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      router.push('/')
    } catch (err) {
      setError('Fehler beim Löschen des Kontos. Bitte kontaktieren Sie den Support.')
      console.error('Delete error:', err)
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
          <div className="space-y-2">
            <Label htmlFor="full_name">Vollständiger Name</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
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
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
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
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
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
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
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
              <MapPin className="absolute left-4 top-4 w-5 h-5 text-warmgray-400" />
              <textarea
                id="address"
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Musterstraße 1&#10;12345 Musterstadt"
                className="w-full min-h-[100px] rounded-md border-2 border-warmgray-200 bg-white pl-12 pr-4 py-3 text-base transition-colors placeholder:text-warmgray-400 focus-visible:outline-none focus-visible:border-sage-400 focus-visible:ring-2 focus-visible:ring-sage-100"
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
    </div>
  )
}
