'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
  HeartPulse, Phone, User, Pill, AlertTriangle, Plus,
  Edit2, Trash2, Loader2, CheckCircle2, Info, Star,
  Heart, FileText, Flower2, Scale, Mail, Upload, Download, Eye, Lock
} from 'lucide-react'
import { SUBSCRIPTION_TIERS, getTierFromSubscription, type TierConfig } from '@/lib/subscription-tiers'
import Link from 'next/link'

interface EmergencyContact {
  id: string
  name: string
  phone: string
  email: string | null
  relationship: string
  is_primary: boolean
  notes: string | null
}

interface MedicalInfo {
  id?: string
  blood_type: string
  allergies: string[]
  medications: string[]
  conditions: string[]
  doctor_name: string
  doctor_phone: string
  insurance_number: string
  additional_notes: string
  organ_donor: boolean | null
  organ_donor_card_location: string
  organ_donor_notes: string
}

interface AdvanceDirectives {
  id?: string
  has_patient_decree: boolean
  patient_decree_location: string
  patient_decree_date: string
  patient_decree_document_id: string | null
  has_power_of_attorney: boolean
  power_of_attorney_location: string
  power_of_attorney_holder: string
  power_of_attorney_date: string
  power_of_attorney_document_id: string | null
  has_care_directive: boolean
  care_directive_location: string
  care_directive_date: string
  care_directive_document_id: string | null
  has_bank_power_of_attorney: boolean
  bank_power_of_attorney_holder: string
  bank_power_of_attorney_banks: string
  bank_power_of_attorney_document_id: string | null
  notes: string
}

interface UploadedDocument {
  id: string
  title: string
  file_path: string
}

interface FuneralWishes {
  id?: string
  burial_type: string
  burial_location: string
  ceremony_type: string
  ceremony_wishes: string
  music_wishes: string
  flowers_wishes: string
  additional_wishes: string
  has_funeral_insurance: boolean
  funeral_insurance_provider: string
  funeral_insurance_number: string
}

const defaultMedicalInfo: MedicalInfo = {
  blood_type: '',
  allergies: [],
  medications: [],
  conditions: [],
  doctor_name: '',
  doctor_phone: '',
  insurance_number: '',
  additional_notes: '',
  organ_donor: null,
  organ_donor_card_location: '',
  organ_donor_notes: '',
}

const defaultAdvanceDirectives: AdvanceDirectives = {
  has_patient_decree: false,
  patient_decree_location: '',
  patient_decree_date: '',
  patient_decree_document_id: null,
  has_power_of_attorney: false,
  power_of_attorney_location: '',
  power_of_attorney_holder: '',
  power_of_attorney_date: '',
  power_of_attorney_document_id: null,
  has_care_directive: false,
  care_directive_location: '',
  care_directive_date: '',
  care_directive_document_id: null,
  has_bank_power_of_attorney: false,
  bank_power_of_attorney_holder: '',
  bank_power_of_attorney_banks: '',
  bank_power_of_attorney_document_id: null,
  notes: '',
}

const defaultFuneralWishes: FuneralWishes = {
  burial_type: '',
  burial_location: '',
  ceremony_type: '',
  ceremony_wishes: '',
  music_wishes: '',
  flowers_wishes: '',
  additional_wishes: '',
  has_funeral_insurance: false,
  funeral_insurance_provider: '',
  funeral_insurance_number: '',
}

const BURIAL_TYPES = [
  { value: '', label: 'Keine Angabe' },
  { value: 'erdbestattung', label: 'Erdbestattung' },
  { value: 'feuerbestattung', label: 'Feuerbestattung / Urne' },
  { value: 'seebestattung', label: 'Seebestattung' },
  { value: 'naturbestattung', label: 'Naturbestattung (Friedwald)' },
  { value: 'keine_praeferenz', label: 'Familie soll entscheiden' },
]

const CEREMONY_TYPES = [
  { value: '', label: 'Keine Angabe' },
  { value: 'kirchlich', label: 'Kirchliche Trauerfeier' },
  { value: 'weltlich', label: 'Weltliche Trauerfeier' },
  { value: 'keine', label: 'Keine Trauerfeier' },
  { value: 'keine_praeferenz', label: 'Familie soll entscheiden' },
]

export default function NotfallPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('notfall')
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([])
  const [medicalInfo, setMedicalInfo] = useState<MedicalInfo>(defaultMedicalInfo)
  const [advanceDirectives, setAdvanceDirectives] = useState<AdvanceDirectives>(defaultAdvanceDirectives)
  const [funeralWishes, setFuneralWishes] = useState<FuneralWishes>(defaultFuneralWishes)

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null)
  const [isMedicalDialogOpen, setIsMedicalDialogOpen] = useState(false)
  const [isDirectivesDialogOpen, setIsDirectivesDialogOpen] = useState(false)
  const [isFuneralDialogOpen, setIsFuneralDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contactForm, setContactForm] = useState({
    name: '', phone: '', email: '', relationship: '', is_primary: false, notes: '',
  })
  const [medicalForm, setMedicalForm] = useState<MedicalInfo>(defaultMedicalInfo)
  const [directivesForm, setDirectivesForm] = useState<AdvanceDirectives>(defaultAdvanceDirectives)
  const [funeralForm, setFuneralForm] = useState<FuneralWishes>(defaultFuneralWishes)

  // User tier and document upload
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, UploadedDocument | null>>({
    patient_decree: null,
    power_of_attorney: null,
    care_directive: null,
    bank_power_of_attorney: null,
  })
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null)

  const supabase = createClient()

  // Check if user can upload Vollmachten (Basic tier or higher)
  const canUploadVollmachten = userTier.id !== 'free'

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch decrypted Notfall data from server API
    try {
      const response = await fetch('/api/notfall')
      if (response.ok) {
        const data = await response.json()

        if (data.emergencyContacts) {
          setEmergencyContacts(data.emergencyContacts)
        }
        if (data.medicalInfo) {
          setMedicalInfo({ ...defaultMedicalInfo, ...data.medicalInfo })
          setMedicalForm({ ...defaultMedicalInfo, ...data.medicalInfo })
        }
        if (data.directives) {
          setAdvanceDirectives({ ...defaultAdvanceDirectives, ...data.directives })
          setDirectivesForm({ ...defaultAdvanceDirectives, ...data.directives })
        }
        if (data.funeralWishes) {
          setFuneralWishes({ ...defaultFuneralWishes, ...data.funeralWishes })
          setFuneralForm({ ...defaultFuneralWishes, ...data.funeralWishes })
        }

        // Fetch uploaded documents for Vollmachten
        if (data.directives) {
          const directives = data.directives
          const docIds = [
            directives.patient_decree_document_id,
            directives.power_of_attorney_document_id,
            directives.care_directive_document_id,
            directives.bank_power_of_attorney_document_id,
          ].filter(Boolean)

          if (docIds.length > 0) {
            const { data: docs } = await supabase
              .from('documents')
              .select('id, title, file_path')
              .in('id', docIds)

            if (docs) {
              const docMap: Record<string, UploadedDocument | null> = {
                patient_decree: null,
                power_of_attorney: null,
                care_directive: null,
                bank_power_of_attorney: null,
              }
              docs.forEach(doc => {
                if (doc.id === directives.patient_decree_document_id) docMap.patient_decree = doc
                if (doc.id === directives.power_of_attorney_document_id) docMap.power_of_attorney = doc
                if (doc.id === directives.care_directive_document_id) docMap.care_directive = doc
                if (doc.id === directives.bank_power_of_attorney_document_id) docMap.bank_power_of_attorney = doc
              })
              setUploadedDocuments(docMap)
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch Notfall data:', err)
    }

    // Fetch user tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()
    if (profile) {
      const tier = getTierFromSubscription(profile.subscription_status, null)
      setUserTier(tier)
    }

    setIsLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleOpenContactDialog = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContact(contact)
      setContactForm({
        name: contact.name, phone: contact.phone, email: contact.email || '', relationship: contact.relationship,
        is_primary: contact.is_primary, notes: contact.notes || '',
      })
    } else {
      setEditingContact(null)
      setContactForm({ name: '', phone: '', email: '', relationship: '', is_primary: emergencyContacts.length === 0, notes: '' })
    }
    setError(null)
    setIsContactDialogOpen(true)
  }

  const handleSaveContact = async () => {
    if (!contactForm.name || !contactForm.phone || !contactForm.relationship) {
      setError('Bitte füllen Sie alle Pflichtfelder aus.')
      return
    }
    setIsSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      if (contactForm.is_primary && !editingContact?.is_primary) {
        await supabase.from('emergency_contacts').update({ is_primary: false }).eq('user_id', user.id)
      }

      const contactToSave = {
        ...(editingContact ? { id: editingContact.id } : {}),
        name: contactForm.name,
        phone: contactForm.phone,
        email: contactForm.email || null,
        relationship: contactForm.relationship,
        is_primary: contactForm.is_primary,
        notes: contactForm.notes || null,
      }

      const response = await fetch('/api/notfall', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emergencyContacts: [contactToSave] }),
      })
      if (!response.ok) throw new Error('Fehler beim Speichern')

      setIsContactDialogOpen(false)
      fetchData()
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Möchten Sie diesen Kontakt wirklich löschen?')) return
    try {
      await supabase.from('emergency_contacts').delete().eq('id', id)
      fetchData()
    } catch (err) { console.error('Delete error:', err) }
  }

  // Document upload for Vollmachten
  const handleVollmachtUpload = async (docType: string, file: File) => {
    if (!canUploadVollmachten) return

    setIsUploadingDoc(docType)
    try {
      // 1. Upload via Server-Side API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', 'vertraege/notfall') // Use 'vertraege' or 'notfall' path
      formData.append('bucket', 'documents')

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json()
        throw new Error(errorData.error || 'Upload fehlgeschlagen')
      }

      const uploadData = await uploadRes.json()
      const { path: filePath, size: fileSize } = uploadData

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // Create document record
      const docTitles: Record<string, string> = {
        patient_decree: 'Patientenverfügung',
        power_of_attorney: 'Vorsorgevollmacht',
        care_directive: 'Betreuungsverfügung',
        bank_power_of_attorney: 'Bankvollmacht',
      }

      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          category: 'vertraege', // Map to Verträge category
          title: docTitles[docType] || file.name,
          file_name: file.name,
          file_path: filePath,
          file_size: fileSize,
          file_type: file.type || 'application/octet-stream',
        })
        .select()
        .single()

      if (docError) throw docError

      // Update advance_directives with document reference
      const updateData: Record<string, string> = {}
      updateData[`${docType}_document_id`] = doc.id

      if (advanceDirectives.id) {
        await supabase.from('advance_directives').update(updateData).eq('id', advanceDirectives.id)
      } else {
        await supabase.from('advance_directives').insert({
          user_id: user.id,
          ...updateData,
        })
      }

      fetchData()
    } catch (err: any) {
      console.error('Upload error:', err)
      alert(err.message || 'Fehler beim Hochladen. Bitte versuchen Sie es erneut.')
    } finally {
      setIsUploadingDoc(null)
    }
  }

  const handleViewDocument = async (docId: string) => {
    const doc = Object.values(uploadedDocuments).find(d => d?.id === docId)
    if (!doc) return

    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60)

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const handleSaveMedicalInfo = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const medicalData = {
        ...(medicalInfo.id ? { id: medicalInfo.id } : {}),
        blood_type: medicalForm.blood_type || null,
        allergies: medicalForm.allergies.filter(Boolean),
        medications: medicalForm.medications.filter(Boolean),
        conditions: medicalForm.conditions.filter(Boolean),
        doctor_name: medicalForm.doctor_name || null,
        doctor_phone: medicalForm.doctor_phone || null,
        insurance_number: medicalForm.insurance_number || null,
        additional_notes: medicalForm.additional_notes || null,
        organ_donor: medicalForm.organ_donor,
        organ_donor_card_location: medicalForm.organ_donor_card_location || null,
        organ_donor_notes: medicalForm.organ_donor_notes || null,
      }

      const response = await fetch('/api/notfall', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicalInfo: medicalData }),
      })
      if (!response.ok) throw new Error('Fehler beim Speichern')

      setIsMedicalDialogOpen(false)
      fetchData()
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDirectives = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const directiveData = {
        ...(advanceDirectives.id ? { id: advanceDirectives.id } : {}),
        has_patient_decree: directivesForm.has_patient_decree,
        patient_decree_location: directivesForm.patient_decree_location || null,
        patient_decree_date: directivesForm.patient_decree_date || null,
        patient_decree_document_id: directivesForm.patient_decree_document_id || null,
        has_power_of_attorney: directivesForm.has_power_of_attorney,
        power_of_attorney_location: directivesForm.power_of_attorney_location || null,
        power_of_attorney_holder: directivesForm.power_of_attorney_holder || null,
        power_of_attorney_date: directivesForm.power_of_attorney_date || null,
        power_of_attorney_document_id: directivesForm.power_of_attorney_document_id || null,
        has_care_directive: directivesForm.has_care_directive,
        care_directive_location: directivesForm.care_directive_location || null,
        care_directive_date: directivesForm.care_directive_date || null,
        care_directive_document_id: directivesForm.care_directive_document_id || null,
        has_bank_power_of_attorney: directivesForm.has_bank_power_of_attorney,
        bank_power_of_attorney_holder: directivesForm.bank_power_of_attorney_holder || null,
        bank_power_of_attorney_banks: directivesForm.bank_power_of_attorney_banks || null,
        bank_power_of_attorney_document_id: directivesForm.bank_power_of_attorney_document_id || null,
        notes: directivesForm.notes || null,
      }

      const response = await fetch('/api/notfall', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directives: directiveData }),
      })
      if (!response.ok) throw new Error('Fehler beim Speichern')

      setIsDirectivesDialogOpen(false)
      fetchData()
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveFuneralWishes = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const funeralData = {
        ...(funeralWishes.id ? { id: funeralWishes.id } : {}),
        burial_type: funeralForm.burial_type || null,
        burial_location: funeralForm.burial_location || null,
        ceremony_type: funeralForm.ceremony_type || null,
        ceremony_wishes: funeralForm.ceremony_wishes || null,
        music_wishes: funeralForm.music_wishes || null,
        flowers_wishes: funeralForm.flowers_wishes || null,
        additional_wishes: funeralForm.additional_wishes || null,
        has_funeral_insurance: funeralForm.has_funeral_insurance,
        funeral_insurance_provider: funeralForm.funeral_insurance_provider || null,
        funeral_insurance_number: funeralForm.funeral_insurance_number || null,
      }

      const response = await fetch('/api/notfall', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funeralWishes: funeralData }),
      })
      if (!response.ok) throw new Error('Fehler beim Speichern')

      setIsFuneralDialogOpen(false)
      fetchData()
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSaving(false)
    }
  }

  const status = (() => {
    let complete = 0
    if (emergencyContacts.length > 0) complete++
    if (medicalInfo.blood_type) complete++
    if (medicalInfo.organ_donor !== null) complete++
    if (advanceDirectives.has_patient_decree || advanceDirectives.has_power_of_attorney) complete++
    if (funeralWishes.burial_type) complete++
    return { complete, total: 5, percentage: Math.round((complete / 5) * 100) }
  })()

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-sage-600" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-0">
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">Notfall & Vorsorge</h1>
        <p className="text-lg text-warmgray-600 mt-2">Wichtige Informationen für den Notfall und Vorsorgedokumente</p>
      </div>

      {/* Beruhigende Erklärung */}
      <Card className="border-sage-200 bg-white">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-sage-600" />
            </div>
            <div>
              <p className="text-warmgray-700">
                Diese Informationen helfen anderen, Ihnen im Ernstfall schnell zu helfen.
              </p>
              <p className="text-warmgray-600 text-sm mt-1">
                Sie entscheiden jederzeit, was hier steht.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sage-200 bg-sage-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
                {status.percentage >= 80 ? <CheckCircle2 className="w-6 h-6 text-sage-600" /> : <Info className="w-6 h-6 text-sage-600" />}
              </div>
              <div>
                <p className="font-medium text-warmgray-900">{status.complete} von {status.total} Bereichen ausgefüllt</p>
                <p className="text-sm text-warmgray-600">{status.percentage >= 80 ? 'Gut gepflegt' : 'Bitte vervollständigen'}</p>
              </div>
            </div>
            <div className="text-3xl font-semibold text-sage-600">{status.percentage}%</div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-warmgray-100/50">
          <TabsTrigger value="notfall" className="py-3 sm:py-2">Notfall</TabsTrigger>
          <TabsTrigger value="gesundheit" className="py-3 sm:py-2">Gesundheit</TabsTrigger>
          <TabsTrigger value="vorsorge" className="py-3 sm:py-2">Vollmachten</TabsTrigger>
          <TabsTrigger value="bestattung" className="py-3 sm:py-2">Bestattung</TabsTrigger>
        </TabsList>

        <TabsContent value="notfall" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex items-center gap-2 flex-wrap text-xl sm:text-2xl">
                    <Phone className="w-5 h-5 text-sage-600 flex-shrink-0" />
                    <span className="truncate sm:whitespace-normal">Notfall-Kontakte</span>
                  </CardTitle>
                  <CardDescription>Personen, die im Notfall kontaktiert werden sollen</CardDescription>
                </div>
                <Button onClick={() => handleOpenContactDialog()} className="w-full sm:w-auto flex-shrink-0">
                  <Plus className="w-4 h-4 mr-2" />
                  Hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emergencyContacts.length > 0 ? (
                <div className="space-y-3">
                  {emergencyContacts.map((contact) => (
                    <div key={contact.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-cream-50 border border-cream-200 gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-sage-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-warmgray-900 truncate">{contact.name}</p>
                            {contact.is_primary && (
                              <span className="px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-sage-100 text-sage-700 rounded-full flex items-center gap-1 flex-shrink-0">
                                <Star className="w-3 h-3" />
                                Hauptkontakt
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-warmgray-600 truncate">{contact.relationship}</p>
                          <p className="text-sm text-warmgray-500 truncate">{contact.phone}</p>
                          {contact.email && <p className="text-sm text-warmgray-500 truncate">{contact.email}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenContactDialog(contact)} className="h-9 w-9">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(contact.id)} className="text-red-600 hover:bg-red-50 h-9 w-9">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Phone className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
                  <p className="text-warmgray-600 mb-6 text-lg senior-mode:text-xl font-medium px-4">Noch keine Notfall-Kontakte</p>
                  <div className="px-4 w-full flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => handleOpenContactDialog()}
                      className="w-full sm:w-auto px-4 sm:px-8 min-h-[3.5rem] h-auto py-3 senior-mode:min-h-[4.5rem] senior-mode:text-xl border-2 whitespace-normal flex items-center justify-center"
                    >
                      <Plus className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span>Ersten Kontakt hinzufügen</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gesundheit" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex items-center gap-2 flex-wrap text-xl sm:text-2xl">
                    <HeartPulse className="w-5 h-5 text-sage-600 flex-shrink-0" />
                    <span>Medizinische Informationen</span>
                  </CardTitle>
                  <CardDescription>Wichtige Gesundheitsdaten für Notfälle</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setMedicalForm(medicalInfo); setError(null); setIsMedicalDialogOpen(true) }}
                  className="w-full sm:w-auto flex-shrink-0"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Bearbeiten
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div><p className="text-sm text-warmgray-500">Blutgruppe</p><p className="font-medium text-warmgray-900">{medicalInfo.blood_type || '–'}</p></div>
                  <div><p className="text-sm text-warmgray-500 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />Allergien</p><p className="font-medium text-warmgray-900">{medicalInfo.allergies.length > 0 ? medicalInfo.allergies.join(', ') : '–'}</p></div>
                  <div><p className="text-sm text-warmgray-500 flex items-center gap-1"><Pill className="w-4 h-4" />Medikamente</p><p className="font-medium text-warmgray-900">{medicalInfo.medications.length > 0 ? medicalInfo.medications.join(', ') : '–'}</p></div>
                </div>
                <div className="space-y-4">
                  <div><p className="text-sm text-warmgray-500">Hausarzt</p><p className="font-medium text-warmgray-900">{medicalInfo.doctor_name || '–'}</p><p className="text-sm text-warmgray-600">{medicalInfo.doctor_phone}</p></div>
                  <div><p className="text-sm text-warmgray-500">Versicherungsnummer</p><p className="font-medium text-warmgray-900">{medicalInfo.insurance_number || '–'}</p></div>
                  <div><p className="text-sm text-warmgray-500">Vorerkrankungen</p><p className="font-medium text-warmgray-900">{medicalInfo.conditions.length > 0 ? medicalInfo.conditions.join(', ') : '–'}</p></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Heart className="w-5 h-5 text-sage-600" />Organspende</CardTitle>
              <CardDescription>Ihre Entscheidung zur Organspende</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-warmgray-500">Organspendeausweis</p>
                  <p className="font-medium text-warmgray-900">
                    {medicalInfo.organ_donor === true && 'Ja, ich bin Organspender'}
                    {medicalInfo.organ_donor === false && 'Nein, keine Organspende'}
                    {medicalInfo.organ_donor === null && '– Keine Angabe'}
                  </p>
                </div>
                {medicalInfo.organ_donor_card_location && (
                  <div><p className="text-sm text-warmgray-500">Aufbewahrungsort</p><p className="font-medium text-warmgray-900">{medicalInfo.organ_donor_card_location}</p></div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vorsorge" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex items-center gap-2 flex-wrap text-xl sm:text-2xl">
                    <Scale className="w-5 h-5 text-sage-600 flex-shrink-0" />
                    <span>Vorsorgedokumente</span>
                  </CardTitle>
                  <CardDescription>Vollmachten und Verfügungen</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setDirectivesForm(advanceDirectives); setError(null); setIsDirectivesDialogOpen(true) }}
                  className="w-full sm:w-auto flex-shrink-0"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Bearbeiten
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { key: 'patient_decree', label: 'Patientenverfügung', has: advanceDirectives.has_patient_decree, location: advanceDirectives.patient_decree_location, icon: FileText },
                  { key: 'power_of_attorney', label: 'Vorsorgevollmacht', has: advanceDirectives.has_power_of_attorney, holder: advanceDirectives.power_of_attorney_holder, icon: Scale },
                  { key: 'care_directive', label: 'Betreuungsverfügung', has: advanceDirectives.has_care_directive, location: advanceDirectives.care_directive_location, icon: User },
                  { key: 'bank_power_of_attorney', label: 'Bankvollmacht', has: advanceDirectives.has_bank_power_of_attorney, holder: advanceDirectives.bank_power_of_attorney_holder, icon: Scale },
                ].map((item) => {
                  const uploadedDoc = uploadedDocuments[item.key]
                  return (
                    <div key={item.label} className="p-4 rounded-lg bg-cream-50 border border-cream-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
                          <item.icon className="w-5 h-5 text-sage-600 flex-shrink-0" />
                          <p className="font-medium text-warmgray-900 truncate">{item.label}</p>
                          <span className={`px-2 py-0.5 text-[10px] sm:text-xs rounded-full whitespace-nowrap ${item.has ? 'bg-green-100 text-green-700' : 'bg-warmgray-100 text-warmgray-600'}`}>
                            {item.has ? 'Vorhanden' : 'Nicht vorhanden'}
                          </span>
                        </div>

                        {/* Document upload/view buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0 justify-end">
                          {uploadedDoc ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDocument(uploadedDoc.id)}
                              title="Dokument ansehen"
                              className="h-9"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ansehen
                            </Button>
                          ) : canUploadVollmachten ? (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleVollmachtUpload(item.key, file)
                                  e.target.value = ''
                                }}
                                disabled={isUploadingDoc === item.key}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                disabled={isUploadingDoc === item.key}
                                className="h-9"
                              >
                                <span>
                                  {isUploadingDoc === item.key ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4 mr-1" />
                                  )}
                                  Hinzufügen
                                </span>
                              </Button>
                            </label>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-warmgray-500 bg-white/50 px-2 py-1 rounded-md border border-warmgray-100">
                              <Lock className="w-3 h-3" />
                              <Link href="/abo" className="hover:underline font-medium">Basis+</Link>
                            </div>
                          )}
                        </div>
                      </div>
                      {item.has && (item.location || item.holder) && (
                        <p className="text-sm text-warmgray-600 ml-8 mt-1">{item.holder ? `Bevollmächtigte(r): ${item.holder}` : `Aufbewahrungsort: ${item.location}`}</p>
                      )}
                      {uploadedDoc && (
                        <p className="text-sm text-sage-600 ml-8 mt-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {uploadedDoc.title}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Upgrade hint for free users */}
              {!canUploadVollmachten && (
                <div className="mt-4 p-4 rounded-lg bg-sage-50 border border-sage-200">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-sage-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-warmgray-900">Vollmachten hinzufügen</p>
                      <p className="text-sm text-warmgray-600 mt-1">
                        Mit dem Basis-Abo können Sie Ihre Vollmachten direkt als Dokument hochladen und sicher aufbewahren.
                      </p>
                      <Link href="/abo" className="text-sm text-sage-600 hover:underline mt-2 inline-block">
                        Jetzt upgraden
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bestattung" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex items-center gap-2 flex-wrap text-xl sm:text-2xl">
                    <Flower2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                    <span>Bestattungswünsche</span>
                  </CardTitle>
                  <CardDescription>Ihre Wünsche für die Bestattung</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setFuneralForm(funeralWishes); setError(null); setIsFuneralDialogOpen(true) }}
                  className="w-full sm:w-auto flex-shrink-0"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Bearbeiten
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div><p className="text-sm text-warmgray-500">Bestattungsart</p><p className="font-medium text-warmgray-900">{BURIAL_TYPES.find(b => b.value === funeralWishes.burial_type)?.label || '– Keine Angabe'}</p></div>
                  {funeralWishes.burial_location && <div><p className="text-sm text-warmgray-500">Gewünschter Ort</p><p className="font-medium text-warmgray-900">{funeralWishes.burial_location}</p></div>}
                  <div><p className="text-sm text-warmgray-500">Trauerfeier</p><p className="font-medium text-warmgray-900">{CEREMONY_TYPES.find(c => c.value === funeralWishes.ceremony_type)?.label || '– Keine Angabe'}</p></div>
                </div>
                <div className="space-y-4">
                  {funeralWishes.music_wishes && <div><p className="text-sm text-warmgray-500">Musikwünsche</p><p className="font-medium text-warmgray-900">{funeralWishes.music_wishes}</p></div>}
                  <div><p className="text-sm text-warmgray-500">Bestattungsvorsorge</p><p className="font-medium text-warmgray-900">{funeralWishes.has_funeral_insurance ? `Ja (${funeralWishes.funeral_insurance_provider || 'Anbieter nicht angegeben'})` : 'Keine'}</p></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Kontakt bearbeiten' : 'Neuen Kontakt hinzufügen'}</DialogTitle>
            <DialogDescription>Person für Notfallkontakt hinzufügen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="space-y-2"><Label htmlFor="name">Name *</Label><Input id="name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="phone">Telefonnummer *</Label><Input id="phone" type="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="email">E-Mail (optional)</Label><Input id="email" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="z.B. beispiel@email.de" /></div>
            <div className="space-y-2"><Label htmlFor="relationship">Beziehung *</Label><Input id="relationship" value={contactForm.relationship} onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })} /></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="is_primary" checked={contactForm.is_primary} onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })} className="w-5 h-5 rounded" /><Label htmlFor="is_primary">Hauptkontakt</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveContact} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMedicalDialogOpen} onOpenChange={setIsMedicalDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Medizinische Informationen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="space-y-2"><Label>Blutgruppe</Label><Input value={medicalForm.blood_type} onChange={(e) => setMedicalForm({ ...medicalForm, blood_type: e.target.value })} placeholder="z.B. A+, 0-" /></div>
            <div className="space-y-2"><Label>Allergien (kommagetrennt)</Label><Input value={medicalForm.allergies.join(', ')} onChange={(e) => setMedicalForm({ ...medicalForm, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <div className="space-y-2"><Label>Medikamente (kommagetrennt)</Label><Input value={medicalForm.medications.join(', ')} onChange={(e) => setMedicalForm({ ...medicalForm, medications: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <div className="space-y-2"><Label>Vorerkrankungen (kommagetrennt)</Label><Input value={medicalForm.conditions.join(', ')} onChange={(e) => setMedicalForm({ ...medicalForm, conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <Separator />
            <div className="space-y-2"><Label>Hausarzt Name</Label><Input value={medicalForm.doctor_name} onChange={(e) => setMedicalForm({ ...medicalForm, doctor_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Hausarzt Telefon</Label><Input value={medicalForm.doctor_phone} onChange={(e) => setMedicalForm({ ...medicalForm, doctor_phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Versicherungsnummer</Label><Input value={medicalForm.insurance_number} onChange={(e) => setMedicalForm({ ...medicalForm, insurance_number: e.target.value })} /></div>
            <Separator />
            <div className="space-y-2">
              <Label>Organspende</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2"><input type="radio" name="organ" checked={medicalForm.organ_donor === true} onChange={() => setMedicalForm({ ...medicalForm, organ_donor: true })} /><span>Ja, Organspender</span></label>
                <label className="flex items-center gap-2"><input type="radio" name="organ" checked={medicalForm.organ_donor === false} onChange={() => setMedicalForm({ ...medicalForm, organ_donor: false })} /><span>Nein</span></label>
                <label className="flex items-center gap-2"><input type="radio" name="organ" checked={medicalForm.organ_donor === null} onChange={() => setMedicalForm({ ...medicalForm, organ_donor: null })} /><span>Keine Angabe</span></label>
              </div>
            </div>
            <div className="space-y-2"><Label>Aufbewahrungsort Ausweis</Label><Input value={medicalForm.organ_donor_card_location} onChange={(e) => setMedicalForm({ ...medicalForm, organ_donor_card_location: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMedicalDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveMedicalInfo} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDirectivesDialogOpen} onOpenChange={setIsDirectivesDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vorsorgedokumente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            {[
              { key: 'patient_decree', label: 'Patientenverfügung', hasLocation: true },
              { key: 'power_of_attorney', label: 'Vorsorgevollmacht', hasHolder: true, hasLocation: true },
              { key: 'care_directive', label: 'Betreuungsverfügung', hasLocation: true },
              { key: 'bank_power_of_attorney', label: 'Bankvollmacht', hasHolder: true, hasBanks: true },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={(directivesForm as any)[`has_${item.key}`]} onChange={(e) => setDirectivesForm({ ...directivesForm, [`has_${item.key}`]: e.target.checked })} className="w-5 h-5 rounded" />
                  <Label className="font-medium">{item.label}</Label>
                </div>
                {(directivesForm as any)[`has_${item.key}`] && (
                  <div className="ml-7 space-y-2">
                    {item.hasHolder && <Input placeholder="Bevollmächtigte Person" value={(directivesForm as any)[`${item.key}_holder`] || ''} onChange={(e) => setDirectivesForm({ ...directivesForm, [`${item.key}_holder`]: e.target.value })} />}
                    {item.hasLocation && <Input placeholder="Aufbewahrungsort" value={(directivesForm as any)[`${item.key}_location`] || ''} onChange={(e) => setDirectivesForm({ ...directivesForm, [`${item.key}_location`]: e.target.value })} />}
                    {item.hasBanks && <Input placeholder="Bei welchen Banken" value={(directivesForm as any)[`${item.key}_banks`] || ''} onChange={(e) => setDirectivesForm({ ...directivesForm, [`${item.key}_banks`]: e.target.value })} />}
                  </div>
                )}
                <Separator />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDirectivesDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveDirectives} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFuneralDialogOpen} onOpenChange={setIsFuneralDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bestattungswünsche</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="space-y-2">
              <Label>Bestattungsart</Label>
              <select value={funeralForm.burial_type} onChange={(e) => setFuneralForm({ ...funeralForm, burial_type: e.target.value })} className="w-full rounded-md border-2 border-warmgray-400 bg-white px-4 py-2 text-base">
                {BURIAL_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>Gewünschter Ort</Label><Input value={funeralForm.burial_location} onChange={(e) => setFuneralForm({ ...funeralForm, burial_location: e.target.value })} /></div>
            <Separator />
            <div className="space-y-2">
              <Label>Trauerfeier</Label>
              <select value={funeralForm.ceremony_type} onChange={(e) => setFuneralForm({ ...funeralForm, ceremony_type: e.target.value })} className="w-full rounded-md border-2 border-warmgray-400 bg-white px-4 py-2 text-base">
                {CEREMONY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>Musikwünsche</Label><Input value={funeralForm.music_wishes} onChange={(e) => setFuneralForm({ ...funeralForm, music_wishes: e.target.value })} /></div>
            <div className="space-y-2"><Label>Blumenwünsche</Label><Input value={funeralForm.flowers_wishes} onChange={(e) => setFuneralForm({ ...funeralForm, flowers_wishes: e.target.value })} /></div>
            <Separator />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={funeralForm.has_funeral_insurance} onChange={(e) => setFuneralForm({ ...funeralForm, has_funeral_insurance: e.target.checked })} className="w-5 h-5 rounded" />
              <Label>Bestattungsvorsorge vorhanden</Label>
            </div>
            {funeralForm.has_funeral_insurance && (
              <div className="ml-7 space-y-2">
                <Input placeholder="Anbieter" value={funeralForm.funeral_insurance_provider} onChange={(e) => setFuneralForm({ ...funeralForm, funeral_insurance_provider: e.target.value })} />
                <Input placeholder="Vertragsnummer" value={funeralForm.funeral_insurance_number} onChange={(e) => setFuneralForm({ ...funeralForm, funeral_insurance_number: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFuneralDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveFuneralWishes} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
