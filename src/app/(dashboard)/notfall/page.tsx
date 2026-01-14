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
  HeartPulse,
  Phone,
  User,
  Pill,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  Info
} from 'lucide-react'

interface EmergencyContact {
  id: string
  name: string
  phone: string
  relationship: string
  is_primary: boolean
}

interface MedicalInfo {
  blood_type: string
  allergies: string[]
  medications: string[]
  conditions: string[]
  doctor_name: string
  doctor_phone: string
  insurance_number: string
}

export default function NotfallPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([])
  const [medicalInfo, setMedicalInfo] = useState<MedicalInfo>({
    blood_type: '',
    allergies: [],
    medications: [],
    conditions: [],
    doctor_name: '',
    doctor_phone: '',
    insurance_number: '',
  })
  
  // Dialog states
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null)
  const [isMedicalDialogOpen, setIsMedicalDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form states
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    relationship: '',
    is_primary: false,
  })

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    // In a real implementation, this would fetch from Supabase
    // For now, we'll use localStorage as a placeholder
    
    const storedContacts = localStorage.getItem('emergencyContacts')
    const storedMedical = localStorage.getItem('medicalInfo')
    
    if (storedContacts) {
      setEmergencyContacts(JSON.parse(storedContacts))
    }
    if (storedMedical) {
      setMedicalInfo(JSON.parse(storedMedical))
    }
    
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveEmergencyContacts = (contacts: EmergencyContact[]) => {
    localStorage.setItem('emergencyContacts', JSON.stringify(contacts))
    setEmergencyContacts(contacts)
  }

  const saveMedicalInfo = (info: MedicalInfo) => {
    localStorage.setItem('medicalInfo', JSON.stringify(info))
    setMedicalInfo(info)
  }

  const handleAddContact = () => {
    setEditingContact(null)
    setContactForm({ name: '', phone: '', relationship: '', is_primary: false })
    setIsContactDialogOpen(true)
  }

  const handleEditContact = (contact: EmergencyContact) => {
    setEditingContact(contact)
    setContactForm({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      is_primary: contact.is_primary,
    })
    setIsContactDialogOpen(true)
  }

  const handleSaveContact = async () => {
    setIsSaving(true)
    
    const newContact: EmergencyContact = {
      id: editingContact?.id || Date.now().toString(),
      ...contactForm,
    }
    
    let updatedContacts: EmergencyContact[]
    if (editingContact) {
      updatedContacts = emergencyContacts.map(c => 
        c.id === editingContact.id ? newContact : c
      )
    } else {
      updatedContacts = [...emergencyContacts, newContact]
    }
    
    // If this is primary, remove primary from others
    if (newContact.is_primary) {
      updatedContacts = updatedContacts.map(c => ({
        ...c,
        is_primary: c.id === newContact.id,
      }))
    }
    
    saveEmergencyContacts(updatedContacts)
    setIsContactDialogOpen(false)
    setIsSaving(false)
  }

  const handleDeleteContact = (id: string) => {
    if (!confirm('Möchten Sie diesen Kontakt wirklich löschen?')) return
    
    const updatedContacts = emergencyContacts.filter(c => c.id !== id)
    saveEmergencyContacts(updatedContacts)
  }

  const completionStatus = () => {
    let complete = 0
    let total = 5
    
    if (emergencyContacts.length > 0) complete++
    if (medicalInfo.blood_type) complete++
    if (medicalInfo.allergies.length > 0 || medicalInfo.medications.length > 0) complete++
    if (medicalInfo.doctor_name && medicalInfo.doctor_phone) complete++
    if (medicalInfo.insurance_number) complete++
    
    return { complete, total, percentage: Math.round((complete / total) * 100) }
  }

  const status = completionStatus()

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
          Notfall & Vorsorge
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Wichtige Informationen für den Notfall – damit Ihre Angehörigen wissen, was zu tun ist
        </p>
      </div>

      {/* Status Card */}
      <Card className="border-sage-200 bg-sage-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
                {status.percentage >= 80 ? (
                  <CheckCircle2 className="w-6 h-6 text-sage-600" />
                ) : (
                  <Info className="w-6 h-6 text-sage-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-warmgray-900">
                  {status.complete} von {status.total} Bereichen ausgefüllt
                </p>
                <p className="text-sm text-warmgray-600">
                  {status.percentage >= 80 
                    ? 'Ihre Notfall-Informationen sind gut gepflegt'
                    : 'Vervollständigen Sie Ihre Notfall-Informationen'}
                </p>
              </div>
            </div>
            <div className="text-3xl font-semibold text-sage-600">
              {status.percentage}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-sage-600" />
                Notfall-Kontakte
              </CardTitle>
              <CardDescription>
                Personen, die im Notfall kontaktiert werden sollen
              </CardDescription>
            </div>
            <Button onClick={handleAddContact}>
              <Plus className="w-4 h-4 mr-2" />
              Kontakt hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {emergencyContacts.length > 0 ? (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <div 
                  key={contact.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-cream-50 border border-cream-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
                      <User className="w-6 h-6 text-sage-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-warmgray-900">{contact.name}</p>
                        {contact.is_primary && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-sage-100 text-sage-700 rounded-full">
                            Hauptkontakt
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-warmgray-600">{contact.relationship}</p>
                      <p className="text-sm text-warmgray-500">{contact.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEditContact(contact)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Phone className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
              <p className="text-warmgray-600 mb-4">
                Noch keine Notfall-Kontakte hinterlegt
              </p>
              <Button variant="outline" onClick={handleAddContact}>
                <Plus className="w-4 h-4 mr-2" />
                Ersten Kontakt hinzufügen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Information */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-sage-600" />
                Medizinische Informationen
              </CardTitle>
              <CardDescription>
                Wichtige Gesundheitsdaten für Notfälle
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setIsMedicalDialogOpen(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-warmgray-500">Blutgruppe</p>
                <p className="font-medium text-warmgray-900">
                  {medicalInfo.blood_type || '–'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-warmgray-500 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Allergien
                </p>
                <p className="font-medium text-warmgray-900">
                  {medicalInfo.allergies.length > 0 
                    ? medicalInfo.allergies.join(', ')
                    : '–'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-warmgray-500 flex items-center gap-1">
                  <Pill className="w-4 h-4" />
                  Medikamente
                </p>
                <p className="font-medium text-warmgray-900">
                  {medicalInfo.medications.length > 0 
                    ? medicalInfo.medications.join(', ')
                    : '–'}
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-warmgray-500">Hausarzt</p>
                <p className="font-medium text-warmgray-900">
                  {medicalInfo.doctor_name || '–'}
                </p>
                <p className="text-sm text-warmgray-600">
                  {medicalInfo.doctor_phone || ''}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-warmgray-500">Krankenversicherungsnummer</p>
                <p className="font-medium text-warmgray-900">
                  {medicalInfo.insurance_number || '–'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-warmgray-500">Vorerkrankungen</p>
                <p className="font-medium text-warmgray-900">
                  {medicalInfo.conditions.length > 0 
                    ? medicalInfo.conditions.join(', ')
                    : '–'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Note */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-warmgray-900 mb-1">Wichtiger Hinweis</p>
              <p className="text-sm text-warmgray-600">
                Diese Informationen ersetzen keine ärztliche Dokumentation. Stellen Sie sicher, 
                dass Ihre Vertrauenspersonen wissen, wo sie diese Daten im Notfall finden können.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Kontakt bearbeiten' : 'Neuen Kontakt hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              Fügen Sie eine Person hinzu, die im Notfall kontaktiert werden soll.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="Max Mustermann"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Telefonnummer</Label>
              <Input
                id="phone"
                type="tel"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                placeholder="+49 123 456789"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="relationship">Beziehung</Label>
              <Input
                id="relationship"
                value={contactForm.relationship}
                onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                placeholder="z.B. Sohn, Tochter, Ehepartner"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={contactForm.is_primary}
                onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                className="w-5 h-5 rounded border-warmgray-300 text-sage-600 focus:ring-sage-500"
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                Als Hauptkontakt festlegen
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSaveContact}
              disabled={!contactForm.name || !contactForm.phone || isSaving}
            >
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

      {/* Medical Info Dialog */}
      <Dialog open={isMedicalDialogOpen} onOpenChange={setIsMedicalDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Medizinische Informationen</DialogTitle>
            <DialogDescription>
              Aktualisieren Sie Ihre medizinischen Daten für den Notfall.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="blood_type">Blutgruppe</Label>
              <Input
                id="blood_type"
                value={medicalInfo.blood_type}
                onChange={(e) => setMedicalInfo({ ...medicalInfo, blood_type: e.target.value })}
                placeholder="z.B. A+, B-, 0+"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergien (kommagetrennt)</Label>
              <Input
                id="allergies"
                value={medicalInfo.allergies.join(', ')}
                onChange={(e) => setMedicalInfo({ 
                  ...medicalInfo, 
                  allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="z.B. Penicillin, Nüsse"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="medications">Medikamente (kommagetrennt)</Label>
              <Input
                id="medications"
                value={medicalInfo.medications.join(', ')}
                onChange={(e) => setMedicalInfo({ 
                  ...medicalInfo, 
                  medications: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="z.B. Aspirin 100mg, Metformin"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="conditions">Vorerkrankungen (kommagetrennt)</Label>
              <Input
                id="conditions"
                value={medicalInfo.conditions.join(', ')}
                onChange={(e) => setMedicalInfo({ 
                  ...medicalInfo, 
                  conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="z.B. Diabetes Typ 2, Bluthochdruck"
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="doctor_name">Hausarzt Name</Label>
              <Input
                id="doctor_name"
                value={medicalInfo.doctor_name}
                onChange={(e) => setMedicalInfo({ ...medicalInfo, doctor_name: e.target.value })}
                placeholder="Dr. med. Beispiel"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="doctor_phone">Hausarzt Telefon</Label>
              <Input
                id="doctor_phone"
                type="tel"
                value={medicalInfo.doctor_phone}
                onChange={(e) => setMedicalInfo({ ...medicalInfo, doctor_phone: e.target.value })}
                placeholder="+49 123 456789"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="insurance_number">Krankenversicherungsnummer</Label>
              <Input
                id="insurance_number"
                value={medicalInfo.insurance_number}
                onChange={(e) => setMedicalInfo({ ...medicalInfo, insurance_number: e.target.value })}
                placeholder="z.B. A123456789"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMedicalDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={() => {
                saveMedicalInfo(medicalInfo)
                setIsMedicalDialogOpen(false)
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
