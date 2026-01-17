'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  HeartPulse, Phone, User, Pill, AlertTriangle, Plus,
  Edit2, Trash2, Loader2, CheckCircle2, Info, Star
} from 'lucide-react'

interface EmergencyContact {
  id: string
  name: string
  phone: string
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
}

export default function NotfallPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([])
  const [medicalInfo, setMedicalInfo] = useState<MedicalInfo>(defaultMedicalInfo)
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null)
  const [isMedicalDialogOpen, setIsMedicalDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contactForm, setContactForm] = useState({
    name: '', phone: '', relationship: '', is_primary: false, notes: '',
  })
  const [medicalForm, setMedicalForm] = useState<MedicalInfo>(defaultMedicalInfo)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: contacts } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false }) as { data: EmergencyContact[] | null }
    if (contacts) setEmergencyContacts(contacts)

    // Use maybeSingle() to handle case where no medical info exists yet
    const { data: medical, error: medicalError } = await supabase
      .from('medical_info')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (medicalError) {
      console.error('Error fetching medical info:', medicalError)
    } else if (medical) {
      setMedicalInfo(medical as MedicalInfo)
      setMedicalForm(medical as MedicalInfo)
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleOpenContactDialog = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContact(contact)
      setContactForm({
        name: contact.name, phone: contact.phone, relationship: contact.relationship,
        is_primary: contact.is_primary, notes: contact.notes || '',
      })
    } else {
      setEditingContact(null)
      setContactForm({ name: '', phone: '', relationship: '', is_primary: emergencyContacts.length === 0, notes: '' })
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

      if (editingContact) {
        const { error } = await supabase.from('emergency_contacts').update({
          name: contactForm.name, phone: contactForm.phone, relationship: contactForm.relationship,
          is_primary: contactForm.is_primary, notes: contactForm.notes || null,
        }).eq('id', editingContact.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('emergency_contacts').insert({
          user_id: user.id, name: contactForm.name, phone: contactForm.phone,
          relationship: contactForm.relationship, is_primary: contactForm.is_primary,
          notes: contactForm.notes || null,
        })
        if (error) throw error
      }
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

  const handleSaveMedicalInfo = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      const medicalData = {
        user_id: user.id,
        blood_type: medicalForm.blood_type || null,
        allergies: medicalForm.allergies.filter(Boolean),
        medications: medicalForm.medications.filter(Boolean),
        conditions: medicalForm.conditions.filter(Boolean),
        doctor_name: medicalForm.doctor_name || null,
        doctor_phone: medicalForm.doctor_phone || null,
        insurance_number: medicalForm.insurance_number || null,
        additional_notes: medicalForm.additional_notes || null,
      }

      if (medicalInfo.id) {
        const { error } = await supabase.from('medical_info').update(medicalData).eq('id', medicalInfo.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('medical_info').insert(medicalData)
        if (error) throw error
      }
      setIsMedicalDialogOpen(false)
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
    if (medicalInfo.allergies.length > 0 || medicalInfo.medications.length > 0) complete++
    if (medicalInfo.doctor_name && medicalInfo.doctor_phone) complete++
    if (medicalInfo.insurance_number) complete++
    return { complete, total: 5, percentage: Math.round((complete / 5) * 100) }
  })()

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-sage-600" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">Notfall & Vorsorge</h1>
        <p className="text-lg text-warmgray-600 mt-2">Wichtige Informationen für den Notfall</p>
      </div>

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

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5 text-sage-600" />Notfall-Kontakte</CardTitle>
              <CardDescription>Personen, die im Notfall kontaktiert werden sollen</CardDescription>
            </div>
            <Button onClick={() => handleOpenContactDialog()}><Plus className="w-4 h-4 mr-2" />Hinzufügen</Button>
          </div>
        </CardHeader>
        <CardContent>
          {emergencyContacts.length > 0 ? (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-4 rounded-lg bg-cream-50 border border-cream-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center"><User className="w-6 h-6 text-sage-600" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-warmgray-900">{contact.name}</p>
                        {contact.is_primary && <span className="px-2 py-0.5 text-xs font-medium bg-sage-100 text-sage-700 rounded-full flex items-center gap-1"><Star className="w-3 h-3" />Hauptkontakt</span>}
                      </div>
                      <p className="text-sm text-warmgray-600">{contact.relationship}</p>
                      <p className="text-sm text-warmgray-500">{contact.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenContactDialog(contact)}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(contact.id)} className="text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Phone className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
              <p className="text-warmgray-600 mb-4">Noch keine Notfall-Kontakte</p>
              <Button variant="outline" onClick={() => handleOpenContactDialog()}><Plus className="w-4 h-4 mr-2" />Ersten Kontakt hinzufügen</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><HeartPulse className="w-5 h-5 text-sage-600" />Medizinische Informationen</CardTitle>
              <CardDescription>Wichtige Gesundheitsdaten für Notfälle</CardDescription>
            </div>
            <Button variant="outline" onClick={() => { setMedicalForm(medicalInfo); setError(null); setIsMedicalDialogOpen(true) }}><Edit2 className="w-4 h-4 mr-2" />Bearbeiten</Button>
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

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-warmgray-900 mb-1">Wichtiger Hinweis</p>
              <p className="text-sm text-warmgray-600">Diese Informationen ersetzen keine ärztliche Dokumentation.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Kontakt bearbeiten' : 'Neuen Kontakt hinzufügen'}</DialogTitle>
            <DialogDescription>Person für Notfallkontakt hinzufügen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="space-y-2"><Label htmlFor="name">Name *</Label><Input id="name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Max Mustermann" /></div>
            <div className="space-y-2"><Label htmlFor="phone">Telefonnummer *</Label><Input id="phone" type="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="+49 123 456789" /></div>
            <div className="space-y-2"><Label htmlFor="relationship">Beziehung *</Label><Input id="relationship" value={contactForm.relationship} onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })} placeholder="z.B. Sohn, Tochter" /></div>
            <div className="space-y-2"><Label htmlFor="notes">Notizen</Label><Input id="notes" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Optional" /></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="is_primary" checked={contactForm.is_primary} onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })} className="w-5 h-5 rounded" /><Label htmlFor="is_primary">Hauptkontakt</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveContact} disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Speichern...</> : 'Speichern'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMedicalDialogOpen} onOpenChange={setIsMedicalDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Medizinische Informationen</DialogTitle>
            <DialogDescription>Gesundheitsdaten für den Notfall</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="space-y-2"><Label htmlFor="blood_type">Blutgruppe</Label><Input id="blood_type" value={medicalForm.blood_type} onChange={(e) => setMedicalForm({ ...medicalForm, blood_type: e.target.value })} placeholder="z.B. A+, B-, 0+" /></div>
            <div className="space-y-2"><Label htmlFor="allergies">Allergien (kommagetrennt)</Label><Input id="allergies" value={medicalForm.allergies.join(', ')} onChange={(e) => setMedicalForm({ ...medicalForm, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="z.B. Penicillin, Nüsse" /></div>
            <div className="space-y-2"><Label htmlFor="medications">Medikamente (kommagetrennt)</Label><Input id="medications" value={medicalForm.medications.join(', ')} onChange={(e) => setMedicalForm({ ...medicalForm, medications: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="z.B. Aspirin 100mg" /></div>
            <div className="space-y-2"><Label htmlFor="conditions">Vorerkrankungen (kommagetrennt)</Label><Input id="conditions" value={medicalForm.conditions.join(', ')} onChange={(e) => setMedicalForm({ ...medicalForm, conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="z.B. Diabetes" /></div>
            <Separator />
            <div className="space-y-2"><Label htmlFor="doctor_name">Hausarzt Name</Label><Input id="doctor_name" value={medicalForm.doctor_name} onChange={(e) => setMedicalForm({ ...medicalForm, doctor_name: e.target.value })} placeholder="Dr. med. Beispiel" /></div>
            <div className="space-y-2"><Label htmlFor="doctor_phone">Hausarzt Telefon</Label><Input id="doctor_phone" type="tel" value={medicalForm.doctor_phone} onChange={(e) => setMedicalForm({ ...medicalForm, doctor_phone: e.target.value })} placeholder="+49 123 456789" /></div>
            <div className="space-y-2"><Label htmlFor="insurance_number">Versicherungsnummer</Label><Input id="insurance_number" value={medicalForm.insurance_number} onChange={(e) => setMedicalForm({ ...medicalForm, insurance_number: e.target.value })} placeholder="z.B. A123456789" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMedicalDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveMedicalInfo} disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Speichern...</> : 'Speichern'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
