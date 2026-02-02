'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Mail,
  Phone,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Crown,
  Link2,
  Clock,
  Download,
  Copy,
  ExternalLink,
  Info,
  Eye,
  Lock
} from 'lucide-react'
import type { TrustedPerson } from '@/types/database'
import { SUBSCRIPTION_TIERS, getTierFromSubscription, canPerformAction, allowsFamilyDownloads, type TierConfig } from '@/lib/subscription-tiers'
import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TierStatusCard, InfoBadge } from '@/components/ui/info-badge'

export default function ZugriffPage() {
  const [trustedPersons, setTrustedPersons] = useState<TrustedPerson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDownloadLinkDialogOpen, setIsDownloadLinkDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<TrustedPerson | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)

  const [downloadLinkForm, setDownloadLinkForm] = useState({
    name: '',
    email: '',
  })
  const [generatedLink, setGeneratedLink] = useState<{ url: string; expiresAt: string; linkType?: 'view' | 'download' } | null>(null)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: '',
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

  const handleOpenDialog = (person?: TrustedPerson) => {
    if (person) {
      setEditingPerson(person)
      setForm({
        name: person.name,
        email: person.email,
        phone: person.phone || '',
        relationship: person.relationship,
        notes: person.notes || '',
      })
    } else {
      setEditingPerson(null)
      setForm({
        name: '',
        email: '',
        phone: '',
        relationship: '',
        notes: '',
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleOpenDownloadLinkDialog = () => {
    setDownloadLinkForm({ name: '', email: '' })
    setGeneratedLink(null)
    setError(null)
    setIsDownloadLinkDialogOpen(true)
  }

  const handleGenerateDownloadLink = async () => {
    // Tier gate: Basic and Premium users can create links
    if (userTier.id === 'free') {
      setError('Links sind nur mit einem kostenpflichtigen Abo verfügbar. Bitte upgraden Sie Ihr Konto.')
      return
    }

    if (!downloadLinkForm.name || !downloadLinkForm.email) {
      setError('Bitte füllen Sie Name und E-Mail aus.')
      return
    }

    setIsGeneratingLink(true)
    setError(null)

    try {
      const response = await fetch('/api/download-link/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: downloadLinkForm.name,
          recipientEmail: downloadLinkForm.email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen')
      }

      setGeneratedLink({
        url: data.downloadUrl,
        expiresAt: data.expiresAt,
        linkType: data.linkType || 'download',
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const copyLinkToClipboard = async () => {
    if (generatedLink?.url) {
      await navigator.clipboard.writeText(generatedLink.url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
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
            notes: form.notes || null,
          })
          .eq('id', editingPerson.id)

        if (error) throw error
      } else {
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
            access_level: 'immediate', // Default to immediate access for family dashboard
            access_delay_hours: 0,
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
    if (!confirm('Möchten Sie diese Person wirklich entfernen?')) return

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
    <TooltipProvider>
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Zugriff & Familie
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Teilen Sie Ihre Dokumente mit vertrauten Personen
        </p>
      </div>

      {/* Tier Status Card */}
      <TierStatusCard tier={userTier.id} />

      {/* Two Options Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Option 1: One-Time Download Link */}
        <Card className="border-sage-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-sage-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Einmal-Download-Link</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-warmgray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {userTier.id === 'premium' ? (
                        <p>Mit Ihrem Premium-Abo können Empfänger alle Dokumente herunterladen</p>
                      ) : userTier.id === 'basic' ? (
                        <p>Mit Ihrem Basis-Abo können Empfänger Dokumente nur ansehen, nicht herunterladen</p>
                      ) : (
                        <p>Upgraden Sie auf Basis oder Premium, um diese Funktion zu nutzen</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>Für schnellen Zugriff ohne Anmeldung</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-warmgray-600">
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Link ist 12 Stunden gültig</span>
              </li>
              <li className="flex items-start gap-2">
                {userTier.id === 'premium' ? (
                  <>
                    <Download className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                    <span>Alle Dokumente als ZIP-Datei</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                    <span>Alle Dokumente ansehen (nur Ansicht)</span>
                  </>
                )}
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Keine Registrierung nötig</span>
              </li>
            </ul>
            {userTier.id === 'premium' ? (
              <Button
                onClick={handleOpenDownloadLinkDialog}
                className="w-full"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Download-Link erstellen
              </Button>
            ) : userTier.id === 'basic' ? (
              <div className="space-y-2">
                <Button
                  onClick={handleOpenDownloadLinkDialog}
                  className="w-full"
                  variant="outline"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ansichts-Link erstellen
                </Button>
                <p className="text-xs text-center text-warmgray-500">
                  <Link href="/abo" className="text-sage-600 hover:underline">Upgrade auf Premium</Link> für Download-Links
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  disabled
                  className="w-full opacity-50"
                  variant="outline"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Kostenpflichtige Funktion
                </Button>
                <p className="text-xs text-center text-warmgray-500">
                  <Link href="/abo" className="text-sage-600 hover:underline">Jetzt upgraden</Link> um Links zu erstellen
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Option 2: Family Dashboard Invitation */}
        <Card className="border-sage-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-sage-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Familien-Übersicht</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-warmgray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {userTier.id === 'premium' ? (
                        <p>Ihre Vertrauenspersonen können Dokumente ansehen und herunterladen</p>
                      ) : userTier.id === 'basic' ? (
                        <p>Ihre Vertrauenspersonen können Dokumente nur ansehen (Upgrade auf Premium für Downloads)</p>
                      ) : (
                        <p>Upgraden Sie auf ein kostenpflichtiges Abo, um diese Funktion zu nutzen</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>Dauerhafter Zugang mit eigenem Konto</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-warmgray-600">
              <li className="flex items-start gap-2">
                <Users className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Gegenseitige Verbindung in der Familie</span>
              </li>
              <li className="flex items-start gap-2">
                <Download className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Jederzeit Dokumente herunterladen</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Registrierung erforderlich</span>
              </li>
            </ul>
            <Button
              onClick={() => handleOpenDialog()}
              className="w-full"
              disabled={!canAddMore}
              variant="outline"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Person einladen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade prompt for free tier */}
      {maxTrustedPersons === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Crown className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 mb-1">Premium-Funktion</p>
                <p className="text-sm text-amber-800 mb-3">
                  Mit einem kostenpflichtigen Abo können Sie Dokumente mit Vertrauenspersonen teilen.
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

      {/* Upgrade prompt for Basic tier */}
      {userTier.id === 'basic' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Download className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-orange-900 mb-1">Upgrade auf Premium für Download-Zugriff</p>
                <p className="text-sm text-orange-800 mb-3">
                  Mit Ihrem Basis-Abo können Ihre Vertrauenspersonen Dokumente nur ansehen. Upgraden Sie auf Premium, damit sie Dokumente auch herunterladen können.
                </p>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span className="text-orange-800">Aktuell: <strong>Nur Ansicht</strong></span>
                  </div>
                  <span className="text-orange-400">→</span>
                  <div className="flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4 text-green-600" />
                    <span className="text-orange-800">Mit Premium: <strong>Ansicht + Download</strong></span>
                  </div>
                </div>
                <Link href="/abo">
                  <Button size="sm" variant="outline" className="border-orange-300 hover:bg-orange-100">
                    Auf Premium upgraden
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trusted Persons List */}
      {trustedPersons.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-warmgray-900">Eingeladene Personen</h2>
            {maxTrustedPersons > 0 && (
              <p className="text-warmgray-600">
                {trustedPersons.length} von {maxTrustedPersons}
              </p>
            )}
          </div>

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
                  {activePersons.map((person) => (
                    <Card key={person.id} className={`border-l-4 ${
                      userTier.id === 'premium' ? 'border-l-green-500' :
                      userTier.id === 'basic' ? 'border-l-blue-500' : 'border-l-warmgray-300'
                    }`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-sage-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-warmgray-900">{person.name}</h3>
                                <InfoBadge type={userTier.id} variant="compact" />
                              </div>
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
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Verbunden
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
                  ))}
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
        </div>
      )}

      {trustedPersons.length === 0 && maxTrustedPersons > 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-warmgray-900 mb-2">
              Noch keine Vertrauenspersonen
            </h3>
            <p className="text-warmgray-600 mb-6 max-w-md mx-auto">
              Wählen Sie oben eine der Optionen, um Ihre Dokumente mit einer vertrauten Person zu teilen.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Download Link Dialog */}
      <Dialog open={isDownloadLinkDialogOpen} onOpenChange={setIsDownloadLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {userTier.id === 'premium' ? (
                <>
                  <Link2 className="w-5 h-5 text-sage-600" />
                  Einmal-Download-Link erstellen
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 text-sage-600" />
                  Ansichts-Link erstellen
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {userTier.id === 'premium' ? (
                <>Erstellen Sie einen Link, mit dem die Person alle Ihre Dokumente als ZIP-Datei herunterladen kann.
                Der Link ist 12 Stunden gültig und kann nur einmal verwendet werden.</>
              ) : (
                <>Erstellen Sie einen Link, mit dem die Person alle Ihre Dokumente im Browser ansehen kann.
                Der Link ist 12 Stunden gültig. Upgrade auf Premium für Download-Links.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {generatedLink ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${generatedLink.linkType === 'view' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className={`w-5 h-5 ${generatedLink.linkType === 'view' ? 'text-blue-600' : 'text-green-600'}`} />
                  <span className={`font-medium ${generatedLink.linkType === 'view' ? 'text-blue-800' : 'text-green-800'}`}>
                    {generatedLink.linkType === 'view' ? 'Ansichts-Link erstellt und per E-Mail gesendet!' : 'Download-Link erstellt und per E-Mail gesendet!'}
                  </span>
                </div>
                <p className={`text-sm ${generatedLink.linkType === 'view' ? 'text-blue-700' : 'text-green-700'}`}>
                  {downloadLinkForm.name} wurde per E-Mail benachrichtigt.
                </p>
              </div>

              {generatedLink.linkType === 'view' && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                  <Eye className="w-4 h-4 inline mr-1" />
                  Mit diesem Link kann die Person Ihre Dokumente nur ansehen, nicht herunterladen.
                  <Link href="/abo" className="block mt-1 text-sage-600 hover:underline">
                    Upgrade auf Premium für Download-Links
                  </Link>
                </div>
              )}

              <div className="space-y-2">
                <Label>{generatedLink.linkType === 'view' ? 'Ansichts-Link' : 'Download-Link'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink.url}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyLinkToClipboard}
                    title="Link kopieren"
                  >
                    {linkCopied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-warmgray-500">
                Gültig bis: {new Date(generatedLink.expiresAt).toLocaleDateString('de-DE')}{' '}
                {new Date(generatedLink.expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>

              <DialogFooter>
                <Button onClick={() => setIsDownloadLinkDialogOpen(false)}>
                  Schließen
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="dl-name">Name des Empfängers *</Label>
                  <Input
                    id="dl-name"
                    value={downloadLinkForm.name}
                    onChange={(e) => setDownloadLinkForm({ ...downloadLinkForm, name: e.target.value })}
                    placeholder="Max Mustermann"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dl-email">E-Mail-Adresse *</Label>
                  <Input
                    id="dl-email"
                    type="email"
                    value={downloadLinkForm.email}
                    onChange={(e) => setDownloadLinkForm({ ...downloadLinkForm, email: e.target.value })}
                    placeholder="max@beispiel.de"
                  />
                  <p className="text-xs text-warmgray-500">
                    Der Link wird automatisch an diese E-Mail-Adresse gesendet.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDownloadLinkDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleGenerateDownloadLink} disabled={isGeneratingLink}>
                  {isGeneratingLink ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Erstellen...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Link erstellen
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Person Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPerson ? 'Person bearbeiten' : 'Person zur Familien-Übersicht einladen'}
            </DialogTitle>
            <DialogDescription>
              {editingPerson
                ? 'Aktualisieren Sie die Daten dieser Person.'
                : 'Laden Sie eine Person ein, die dann Zugriff auf Ihre Dokumente in der Familien-Übersicht hat.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
    </TooltipProvider>
  )
}
