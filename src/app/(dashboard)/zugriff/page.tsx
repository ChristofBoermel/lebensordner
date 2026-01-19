'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  UserPlus,
  Shield,
  Clock,
  AlertTriangle,
  Mail,
  Phone,
  Edit2,
  Trash2,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
  Send,
  Crown
} from 'lucide-react'
import type { TrustedPerson } from '@/types/database'
import { SUBSCRIPTION_TIERS, getTierFromSubscription, canPerformAction, type TierConfig } from '@/lib/subscription-tiers'
import Link from 'next/link'

const ACCESS_LEVELS = {
  immediate: {
    name: 'Sofortiger Zugriff',
    description: 'Kann jederzeit auf Ihre Dokumente zugreifen',
    color: 'text-green-600 bg-green-50 border-green-200',
    icon: CheckCircle2,
  },
  emergency: {
    name: 'Notfall-Zugriff',
    description: 'Zugriff nach Wartezeit möglich',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    icon: Clock,
  },
  after_confirmation: {
    name: 'Nach Bestätigung',
    description: 'Zugriff nur nach Ihrer expliziten Freigabe',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    icon: Shield,
  },
}

export default function ZugriffPage() {
  const searchParams = useSearchParams()
  const shouldOpenAdd = searchParams.get('add') === 'true'

  const [trustedPersons, setTrustedPersons] = useState<TrustedPerson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<TrustedPerson | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: '',
    access_level: 'emergency' as TrustedPerson['access_level'],
    access_delay_hours: 48,
    notes: '',
  })

  const supabase = createClient()

  // Fetch user tier
  useEffect(() => {
    async function fetchTier() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, stripe_price_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        const tier = getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
        setUserTier(tier)
      }
    }
    fetchTier()
  }, [supabase])

  const fetchTrustedPersons = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('trusted_persons')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTrustedPersons(data)
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchTrustedPersons()
  }, [fetchTrustedPersons])

  // Open dialog if URL param is set and user can add persons
  useEffect(() => {
    if (shouldOpenAdd && canPerformAction(userTier, 'addTrustedPerson', trustedPersons.length)) {
      setIsDialogOpen(true)
    }
  }, [shouldOpenAdd, userTier, trustedPersons.length])

  const handleOpenDialog = (person?: TrustedPerson) => {
    if (person) {
      setEditingPerson(person)
      setForm({
        name: person.name,
        email: person.email,
        phone: person.phone || '',
        relationship: person.relationship,
        access_level: person.access_level,
        access_delay_hours: person.access_delay_hours,
        notes: person.notes || '',
      })
    } else {
      setEditingPerson(null)
      setForm({
        name: '',
        email: '',
        phone: '',
        relationship: '',
        access_level: 'emergency',
        access_delay_hours: 48,
        notes: '',
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email || !form.relationship) {
      setError('Bitte füllen Sie alle Pflichtfelder aus.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      if (editingPerson) {
        const { error } = await supabase
          .from('trusted_persons')
          .update({
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            relationship: form.relationship,
            access_level: form.access_level,
            access_delay_hours: form.access_delay_hours,
            notes: form.notes || null,
          })
          .eq('id', editingPerson.id)

        if (error) throw error
      } else {
        // Check limit based on tier
        if (!canPerformAction(userTier, 'addTrustedPerson', trustedPersons.length)) {
          if (userTier.limits.maxTrustedPersons === 0) {
            setError('Vertrauenspersonen sind nur mit einem kostenpflichtigen Abo verfügbar.')
          } else {
            setError(`Sie können maximal ${userTier.limits.maxTrustedPersons} Vertrauenspersonen hinzufügen. Upgraden Sie für mehr.`)
          }
          return
        }

        const { error } = await supabase
          .from('trusted_persons')
          .insert({
            user_id: user.id,
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            relationship: form.relationship,
            access_level: form.access_level,
            access_delay_hours: form.access_delay_hours,
            notes: form.notes || null,
          })

        if (error) throw error
      }

      setIsDialogOpen(false)
      fetchTrustedPersons()
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Vertrauensperson wirklich entfernen?')) return

    try {
      const { error } = await supabase
        .from('trusted_persons')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchTrustedPersons()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleSendInvite = async (personId: string) => {
    try {
      const response = await fetch('/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: personId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Senden')
      }

      alert('Einladung wurde erfolgreich gesendet!')
      fetchTrustedPersons()
    } catch (err: any) {
      alert('Fehler: ' + err.message)
      console.error('Invite error:', err)
    }
  }

  const handleToggleActive = async (person: TrustedPerson) => {
    try {
      const { error } = await supabase
        .from('trusted_persons')
        .update({ is_active: !person.is_active })
        .eq('id', person.id)

      if (error) throw error
      fetchTrustedPersons()
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const activePersons = trustedPersons.filter(p => p.is_active)
  const inactivePersons = trustedPersons.filter(p => !p.is_active)
  const maxTrustedPersons = userTier.limits.maxTrustedPersons
  const canAddMore = canPerformAction(userTier, 'addTrustedPerson', trustedPersons.length)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Zugriff & Familie
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Bestimmen Sie, wer im Notfall auf Ihre Informationen zugreifen darf
        </p>
      </div>

      {/* Info Card */}
      <Card className="border-sage-200 bg-sage-50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Shield className="w-6 h-6 text-sage-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-warmgray-900 mb-1">So funktioniert der Zugriff</p>
              <p className="text-sm text-warmgray-600">
                Vertrauenspersonen erhalten im Notfall Zugang zu Ihren hinterlegten Informationen.
                Sie können für jede Person festlegen, ob der Zugriff sofort, nach einer Wartezeit
                oder nur nach Ihrer Bestätigung möglich sein soll.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade prompt for free tier */}
      {maxTrustedPersons === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Crown className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 mb-1">Vertrauenspersonen hinzufügen</p>
                <p className="text-sm text-amber-800 mb-3">
                  Mit einem kostenpflichtigen Abo können Sie Vertrauenspersonen hinzufügen, die im Notfall auf Ihre Dokumente zugreifen dürfen.
                </p>
                <Link href="/abo">
                  <Button size="sm" variant="outline" className="border-amber-300 hover:bg-amber-100">
                    Jetzt upgraden
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Person Button */}
      {maxTrustedPersons > 0 && (
        <div className="flex justify-between items-center">
          <div>
            <p className="text-warmgray-600">
              {trustedPersons.length} von {maxTrustedPersons} Vertrauenspersonen
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={!canAddMore}>
            <UserPlus className="w-4 h-4 mr-2" />
            Person hinzufügen
          </Button>
        </div>
      )}

      {/* Trusted Persons List */}
      {trustedPersons.length > 0 ? (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Aktiv ({activePersons.length})
            </TabsTrigger>
            {inactivePersons.length > 0 && (
              <TabsTrigger value="inactive">
                Deaktiviert ({inactivePersons.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activePersons.length > 0 ? (
              <div className="space-y-4">
                {activePersons.map((person) => {
                  const accessInfo = ACCESS_LEVELS[person.access_level]
                  const AccessIcon = accessInfo.icon
                  return (
                    <Card key={person.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-sage-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-warmgray-900">{person.name}</h3>
                              <p className="text-sm text-warmgray-600">{person.relationship}</p>

                              <div className="flex items-center gap-4 mt-2 text-sm text-warmgray-500">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  {person.email}
                                </span>
                                {person.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {person.phone}
                                  </span>
                                )}
                              </div>

                              <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg border ${accessInfo.color}`}>
                                <AccessIcon className="w-4 h-4" />
                                <span className="text-sm font-medium">{accessInfo.name}</span>
                                {person.access_level === 'emergency' && (
                                  <span className="text-xs">({person.access_delay_hours}h Wartezeit)</span>
                                )}
                              </div>

                              {person.notes && (
                                <p className="text-sm text-warmgray-500 mt-2 italic">
                                  {person.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(!person.invitation_status || person.invitation_status === 'pending') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendInvite(person.id)}
                                title="Einladung senden"
                                className="text-sage-600 hover:text-sage-700"
                              >
                                <Send className="w-4 h-4 mr-1" />
                                Einladen
                              </Button>
                            )}
                            {person.invitation_status === 'sent' && (
                              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                Einladung gesendet
                              </span>
                            )}
                            {person.invitation_status === 'accepted' && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                Akzeptiert
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(person)}
                              title="Bearbeiten"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(person)}
                              title="Deaktivieren"
                            >
                              <XCircle className="w-4 h-4 text-warmgray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(person.id)}
                              title="Löschen"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
                  <p className="text-warmgray-600">
                    Keine aktiven Vertrauenspersonen
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {inactivePersons.length > 0 && (
            <TabsContent value="inactive" className="mt-6">
              <div className="space-y-4">
                {inactivePersons.map((person) => (
                  <Card key={person.id} className="opacity-60">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-full bg-warmgray-100 flex items-center justify-center flex-shrink-0">
                            <Users className="w-6 h-6 text-warmgray-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-warmgray-700">{person.name}</h3>
                            <p className="text-sm text-warmgray-500">{person.relationship}</p>
                            <p className="text-sm text-warmgray-500 mt-1">{person.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(person)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Aktivieren
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(person.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      ) : maxTrustedPersons > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-warmgray-900 mb-2">
              Noch keine Vertrauenspersonen
            </h3>
            <p className="text-warmgray-600 mb-6 max-w-md mx-auto">
              Fügen Sie Personen hinzu, die im Notfall auf Ihre hinterlegten
              Informationen zugreifen dürfen.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <UserPlus className="w-4 h-4 mr-2" />
              Erste Person hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPerson ? 'Vertrauensperson bearbeiten' : 'Vertrauensperson hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              {editingPerson
                ? 'Aktualisieren Sie die Daten dieser Vertrauensperson.'
                : 'Fügen Sie eine Person hinzu, die im Notfall auf Ihre Daten zugreifen darf.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Max Mustermann"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="max@beispiel.de"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefonnummer</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+49 123 456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationship">Beziehung *</Label>
              <Input
                id="relationship"
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                placeholder="z.B. Sohn, Tochter, Ehepartner"
              />
            </div>

            <div className="space-y-3">
              <Label>Zugriffsart</Label>
              <div className="space-y-2">
                {Object.entries(ACCESS_LEVELS).map(([key, level]) => {
                  const Icon = level.icon
                  return (
                    <label
                      key={key}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.access_level === key
                          ? 'border-sage-500 bg-sage-50'
                          : 'border-warmgray-200 hover:border-warmgray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="access_level"
                        value={key}
                        checked={form.access_level === key}
                        onChange={() => setForm({ ...form, access_level: key as TrustedPerson['access_level'] })}
                        className="sr-only"
                      />
                      <Icon className={`w-5 h-5 mt-0.5 ${form.access_level === key ? 'text-sage-600' : 'text-warmgray-400'}`} />
                      <div>
                        <p className="font-medium text-warmgray-900">{level.name}</p>
                        <p className="text-sm text-warmgray-500">{level.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {form.access_level === 'emergency' && (
              <div className="space-y-2">
                <Label htmlFor="delay">Wartezeit (Stunden)</Label>
                <Input
                  id="delay"
                  type="number"
                  min="1"
                  max="168"
                  value={form.access_delay_hours}
                  onChange={(e) => setForm({ ...form, access_delay_hours: parseInt(e.target.value) || 48 })}
                />
                <p className="text-xs text-warmgray-500">
                  Nach dieser Zeit kann die Person auf Ihre Daten zugreifen, wenn Sie nicht reagieren.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notizen (optional)</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
