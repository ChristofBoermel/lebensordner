'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertTriangle, Loader2, Shield, Users, FileText, Clock, CheckCircle2,
  XCircle, Eye, HeartPulse, Phone, User, Pill, Scale, Flower2,
  Download, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'

interface AccessRecord {
  trusted_person_id: string
  owner_id: string
  owner_name: string
  owner_email: string
  relationship: string
  access_level: string
  accepted_at: string
  emergency_access: {
    status: string
    requested_at: string
    approved_at: string | null
    expires_at: string | null
  } | null
}

interface EmergencyDocument {
  id: string
  title: string
  category: DocumentCategory
  file_name: string
  file_type: string
  file_size: number
  created_at: string
  expiry_date: string | null
  notes: string | null
}

interface EmergencyInfo {
  medical: any
  directives: any
  contacts: any[]
  funeral: any
}

export default function VPDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>([])
  const [selectedOwner, setSelectedOwner] = useState<AccessRecord | null>(null)
  const [documents, setDocuments] = useState<EmergencyDocument[]>([])
  const [emergencyInfo, setEmergencyInfo] = useState<EmergencyInfo | null>(null)
  const [accessExpiry, setAccessExpiry] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestingFor, setRequestingFor] = useState<AccessRecord | null>(null)

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const supabase = createClient()

  // Try to link any pending trusted person invitations when page loads
  const linkPendingInvitations = useCallback(async () => {
    try {
      await fetch('/api/trusted-person/link', { method: 'POST' })
    } catch (err) {
      console.error('Error linking invitations:', err)
    }
  }, [])

  const fetchAccessRecords = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/trusted-person/my-access')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setAccessRecords(data.access || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // First try to link any pending invitations, then fetch access records
    const init = async () => {
      await linkPendingInvitations()
      await fetchAccessRecords()
    }
    init()
  }, [linkPendingInvitations, fetchAccessRecords])

  const fetchOwnerDocuments = async (ownerId: string) => {
    try {
      const response = await fetch(`/api/emergency-access/documents?ownerId=${ownerId}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setDocuments([])
          setEmergencyInfo(null)
          setAccessExpiry(null)
          return
        }
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setDocuments(data.documents || [])
      setEmergencyInfo(data.emergency_info || null)
      setAccessExpiry(data.access?.expires_at || null)
    } catch (err: any) {
      console.error('Error fetching documents:', err)
      setDocuments([])
      setEmergencyInfo(null)
    }
  }

  const handleSelectOwner = async (record: AccessRecord) => {
    setSelectedOwner(record)
    if (record.emergency_access?.status === 'approved') {
      await fetchOwnerDocuments(record.owner_id)
    }
  }

  const handleRequestAccess = async () => {
    if (!requestingFor) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/emergency-access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trustedPersonId: requestingFor.trusted_person_id,
          reason: requestReason,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Anfrage fehlgeschlagen')
      }

      setIsRequestDialogOpen(false)
      setRequestReason('')
      fetchAccessRecords()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openRequestDialog = (record: AccessRecord) => {
    setRequestingFor(record)
    setRequestReason('')
    setIsRequestDialogOpen(true)
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const getAccessStatusBadge = (record: AccessRecord) => {
    if (!record.emergency_access) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-warmgray-100 text-warmgray-600">
          Kein Zugriff
        </span>
      )
    }

    switch (record.emergency_access.status) {
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Anfrage ausstehend
          </span>
        )
      case 'approved':
        const isExpired = record.emergency_access.expires_at &&
          new Date(record.emergency_access.expires_at) < new Date()
        if (isExpired) {
          return (
            <span className="px-2 py-1 text-xs rounded-full bg-warmgray-100 text-warmgray-600">
              Zugriff abgelaufen
            </span>
          )
        }
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Zugriff aktiv
          </span>
        )
      case 'denied':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Abgelehnt
          </span>
        )
      default:
        return null
    }
  }

  const groupDocumentsByCategory = (docs: EmergencyDocument[]) => {
    const grouped: Record<string, EmergencyDocument[]> = {}
    docs.forEach(doc => {
      if (!grouped[doc.category]) {
        grouped[doc.category] = []
      }
      grouped[doc.category].push(doc)
    })
    return grouped
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">Notfall-Zentrale</h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Zugriff auf Lebensordner von Personen, die Sie als Vertrauensperson eingetragen haben
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {accessRecords.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Users className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-warmgray-900 mb-2">
              Keine Verknüpfungen vorhanden
            </h3>
            <p className="text-warmgray-600 max-w-md mx-auto">
              Sie wurden noch nicht als Vertrauensperson eingetragen. Wenn jemand Sie
              als Vertrauensperson hinzufügt, erscheinen die Zugänge hier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Access List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-warmgray-900">Ihre Zugänge</h2>
            {accessRecords.map((record) => (
              <Card
                key={record.trusted_person_id}
                className={`cursor-pointer transition-all ${selectedOwner?.trusted_person_id === record.trusted_person_id
                  ? 'ring-2 ring-sage-500 border-sage-300'
                  : 'hover:border-sage-200'
                  }`}
                onClick={() => handleSelectOwner(record)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-sage-600" />
                      </div>
                      <div>
                        <p className="font-medium text-warmgray-900">{record.owner_name}</p>
                        <p className="text-sm text-warmgray-500">{record.relationship}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {getAccessStatusBadge(record)}
                    {(!record.emergency_access ||
                      record.emergency_access.status === 'denied' ||
                      (record.emergency_access.status === 'approved' &&
                        record.emergency_access.expires_at &&
                        new Date(record.emergency_access.expires_at) < new Date())) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            openRequestDialog(record)
                          }}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Notfallzugriff
                        </Button>
                      )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-2">
            {selectedOwner ? (
              selectedOwner.emergency_access?.status === 'approved' &&
                selectedOwner.emergency_access?.expires_at &&
                new Date(selectedOwner.emergency_access.expires_at) > new Date() ? (
                <div className="space-y-6">
                  {/* Access Info Banner */}
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Shield className="w-6 h-6 text-green-600" />
                          <div>
                            <p className="font-medium text-green-800">Notfallzugriff aktiv</p>
                            <p className="text-sm text-green-600">
                              Gültig bis: {new Date(accessExpiry!).toLocaleDateString('de-DE', { dateStyle: 'full' })}
                              {' '}{new Date(accessExpiry!).toLocaleTimeString('de-DE', { timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Tabs defaultValue="dokumente">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
                      <TabsTrigger value="notfall">Notfall-Infos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dokumente" className="mt-4 space-y-4">
                      {documents.length === 0 ? (
                        <Card>
                          <CardContent className="pt-8 pb-8 text-center">
                            <FileText className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
                            <p className="text-warmgray-600">Keine Dokumente vorhanden</p>
                          </CardContent>
                        </Card>
                      ) : (
                        Object.entries(groupDocumentsByCategory(documents)).map(([category, docs]) => (
                          <Card key={category}>
                            <CardHeader
                              className="cursor-pointer hover:bg-cream-50 transition-colors py-3"
                              onClick={() => toggleCategory(category)}
                            >
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                  {DOCUMENT_CATEGORIES[category as DocumentCategory]?.name || category}
                                  <span className="text-sm font-normal text-warmgray-500">
                                    ({docs.length})
                                  </span>
                                </CardTitle>
                                {expandedCategories.has(category) ? (
                                  <ChevronUp className="w-5 h-5 text-warmgray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-warmgray-400" />
                                )}
                              </div>
                            </CardHeader>
                            {expandedCategories.has(category) && (
                              <CardContent className="pt-0">
                                <div className="space-y-2">
                                  {docs.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="flex items-center justify-between p-3 rounded-lg bg-cream-50 border border-cream-200"
                                    >
                                      <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-sage-600" />
                                        <div>
                                          <p className="font-medium text-warmgray-900">{doc.title}</p>
                                          <p className="text-sm text-warmgray-500">
                                            {doc.file_name} • {formatFileSize(doc.file_size)}
                                          </p>
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="icon" title="Vorschau">
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="notfall" className="mt-4 space-y-4">
                      {/* Medical Info */}
                      {emergencyInfo?.medical && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <HeartPulse className="w-5 h-5 text-sage-600" />
                              Medizinische Informationen
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-warmgray-500">Blutgruppe</p>
                                <p className="font-medium">{emergencyInfo.medical.blood_type || '–'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-warmgray-500">Allergien</p>
                                <p className="font-medium">
                                  {emergencyInfo.medical.allergies?.length > 0
                                    ? emergencyInfo.medical.allergies.join(', ')
                                    : '–'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-warmgray-500">Medikamente</p>
                                <p className="font-medium">
                                  {emergencyInfo.medical.medications?.length > 0
                                    ? emergencyInfo.medical.medications.join(', ')
                                    : '–'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-warmgray-500">Hausarzt</p>
                                <p className="font-medium">{emergencyInfo.medical.doctor_name || '–'}</p>
                                {emergencyInfo.medical.doctor_phone && (
                                  <p className="text-sm text-sage-600">{emergencyInfo.medical.doctor_phone}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Emergency Contacts */}
                      {emergencyInfo?.contacts && emergencyInfo.contacts.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Phone className="w-5 h-5 text-sage-600" />
                              Notfall-Kontakte
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {emergencyInfo.contacts.map((contact: any) => (
                                <div key={contact.id} className="flex items-center justify-between p-3 rounded-lg bg-cream-50">
                                  <div>
                                    <p className="font-medium">{contact.name}</p>
                                    <p className="text-sm text-warmgray-500">{contact.relationship}</p>
                                  </div>
                                  <a
                                    href={`tel:${contact.phone}`}
                                    className="text-sage-600 font-medium hover:underline"
                                  >
                                    {contact.phone}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Advance Directives */}
                      {emergencyInfo?.directives && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Scale className="w-5 h-5 text-sage-600" />
                              Vorsorgedokumente
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {emergencyInfo.directives.has_patient_decree && (
                              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                                <p className="font-medium text-green-800">Patientenverfügung vorhanden</p>
                                {emergencyInfo.directives.patient_decree_location && (
                                  <p className="text-sm text-green-600">
                                    Ort: {emergencyInfo.directives.patient_decree_location}
                                  </p>
                                )}
                              </div>
                            )}
                            {emergencyInfo.directives.has_power_of_attorney && (
                              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                                <p className="font-medium text-green-800">Vorsorgevollmacht vorhanden</p>
                                {emergencyInfo.directives.power_of_attorney_holder && (
                                  <p className="text-sm text-green-600">
                                    Bevollmächtigte(r): {emergencyInfo.directives.power_of_attorney_holder}
                                  </p>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {!emergencyInfo?.medical && !emergencyInfo?.contacts?.length && !emergencyInfo?.directives && (
                        <Card>
                          <CardContent className="pt-8 pb-8 text-center">
                            <HeartPulse className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
                            <p className="text-warmgray-600">Keine Notfall-Informationen hinterlegt</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-12 pb-12 text-center">
                    <Shield className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-warmgray-900 mb-2">
                      {selectedOwner.emergency_access?.status === 'pending'
                        ? 'Anfrage ausstehend'
                        : 'Kein aktiver Zugriff'}
                    </h3>
                    <p className="text-warmgray-600 max-w-md mx-auto mb-6">
                      {selectedOwner.emergency_access?.status === 'pending'
                        ? `Ihre Anfrage wurde an ${selectedOwner.owner_name} gesendet. Sie werden benachrichtigt, sobald die Anfrage bearbeitet wurde.`
                        : `Um auf die Dokumente von ${selectedOwner.owner_name} zuzugreifen, müssen Sie einen Notfallzugriff anfordern.`}
                    </p>
                    {selectedOwner.emergency_access?.status !== 'pending' && (
                      <Button
                        onClick={() => openRequestDialog(selectedOwner)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Notfallzugriff anfordern
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Users className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-warmgray-900 mb-2">
                    Wählen Sie einen Zugang
                  </h3>
                  <p className="text-warmgray-600">
                    Klicken Sie auf eine Person in der Liste links, um Details anzuzeigen.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Notfallzugriff anfordern
            </DialogTitle>
            <DialogDescription>
              Sie fordern Notfallzugriff auf den Lebensordner von{' '}
              <strong>{requestingFor?.owner_name}</strong> an.
              Die Person wird per E-Mail benachrichtigt und muss den Zugriff genehmigen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>Hinweis:</strong> Nutzen Sie diese Funktion nur in echten Notfällen.
                Missbrauch kann rechtliche Konsequenzen haben.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Grund für die Anfrage (optional)</Label>
              <Input
                id="reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="z.B. Medizinischer Notfall, Krankenhausaufenthalt..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleRequestAccess}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Zugriff anfordern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
