'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  FileDown,
  Printer,
  FileText,
  Users,
  Heart,
  Shield,
  Loader2,
  CheckCircle2,
  Calendar,
  Archive,
  Download,
  HardDrive
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'
import { formatDate } from '@/lib/utils'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

interface DocumentRow {
  id: string
  category: DocumentCategory
  title: string
  notes: string | null
  file_name: string
  created_at: string
  expiry_date: string | null
}

interface TrustedPersonRow {
  id: string
  name: string
  email: string
  phone: string | null
  relationship: string
  access_level: string
}

interface ProfileRow {
  full_name: string | null
  email: string
  phone: string | null
  address: string | null
}

export default function ExportPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [backupProgress, setBackupProgress] = useState(0)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [trustedPersons, setTrustedPersons] = useState<TrustedPersonRow[]>([])
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([])
  const [medicalInfo, setMedicalInfo] = useState<any>(null)
  const [reminders, setReminders] = useState<any[]>([])

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, phone, address')
      .eq('id', user.id)
      .single() as { data: ProfileRow | null }
    
    if (profileData) setProfile(profileData)

    // Fetch documents
    const { data: docsData } = await supabase
      .from('documents')
      .select('id, category, title, notes, file_name, created_at, expiry_date')
      .eq('user_id', user.id)
      .order('category') as { data: DocumentRow[] | null }
    
    if (docsData) setDocuments(docsData)

    // Fetch trusted persons
    const { data: trustedData } = await supabase
      .from('trusted_persons')
      .select('id, name, email, phone, relationship, access_level')
      .eq('user_id', user.id)
      .eq('is_active', true) as { data: TrustedPersonRow[] | null }
    
    if (trustedData) setTrustedPersons(trustedData)

    // Fetch emergency info from localStorage (will be migrated to Supabase later)
    const storedContacts = localStorage.getItem('emergencyContacts')
    const storedMedical = localStorage.getItem('medicalInfo')
    
    if (storedContacts) setEmergencyContacts(JSON.parse(storedContacts))
    if (storedMedical) setMedicalInfo(JSON.parse(storedMedical))

    // Fetch reminders
    const { data: remindersData } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
    
    if (remindersData) setReminders(remindersData)

    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const generatePDF = async () => {
    setIsGenerating(true)
    
    try {
      // Dynamic import to avoid SSR issues
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const autoTable = (await import('jspdf-autotable')).default
      
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos = 20

      // Helper function
      const addSection = (title: string) => {
        if (yPos > 250) {
          doc.addPage()
          yPos = 20
        }
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(title, 14, yPos)
        yPos += 10
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
      }

      // Title
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('Lebensordner Digital', pageWidth / 2, yPos, { align: 'center' })
      yPos += 10
      
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Übersicht aller wichtigen Informationen', pageWidth / 2, yPos, { align: 'center' })
      yPos += 8
      
      doc.setFontSize(10)
      doc.text(`Erstellt am: ${formatDate(new Date())}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 15

      // Personal Info
      addSection('Persönliche Daten')
      if (profile) {
        doc.text(`Name: ${profile.full_name || '-'}`, 14, yPos); yPos += 6
        doc.text(`E-Mail: ${profile.email || '-'}`, 14, yPos); yPos += 6
        doc.text(`Telefon: ${profile.phone || '-'}`, 14, yPos); yPos += 6
        if (profile.address) {
          doc.text(`Adresse: ${profile.address.replace(/\n/g, ', ')}`, 14, yPos); yPos += 6
        }
      }
      yPos += 10

      // Emergency Contacts
      if (emergencyContacts.length > 0) {
        addSection('Notfall-Kontakte')
        emergencyContacts.forEach((contact: any) => {
          doc.text(`• ${contact.name} (${contact.relationship}): ${contact.phone}`, 14, yPos)
          yPos += 6
        })
        yPos += 10
      }

      // Medical Info
      if (medicalInfo && (medicalInfo.blood_type || medicalInfo.allergies?.length > 0 || medicalInfo.medications?.length > 0)) {
        addSection('Medizinische Informationen')
        if (medicalInfo.blood_type) {
          doc.text(`Blutgruppe: ${medicalInfo.blood_type}`, 14, yPos); yPos += 6
        }
        if (medicalInfo.allergies?.length > 0) {
          doc.text(`Allergien: ${medicalInfo.allergies.join(', ')}`, 14, yPos); yPos += 6
        }
        if (medicalInfo.medications?.length > 0) {
          doc.text(`Medikamente: ${medicalInfo.medications.join(', ')}`, 14, yPos); yPos += 6
        }
        if (medicalInfo.conditions?.length > 0) {
          doc.text(`Vorerkrankungen: ${medicalInfo.conditions.join(', ')}`, 14, yPos); yPos += 6
        }
        if (medicalInfo.doctor_name) {
          doc.text(`Hausarzt: ${medicalInfo.doctor_name} (${medicalInfo.doctor_phone || '-'})`, 14, yPos); yPos += 6
        }
        if (medicalInfo.insurance_number) {
          doc.text(`Versicherungsnummer: ${medicalInfo.insurance_number}`, 14, yPos); yPos += 6
        }
        yPos += 10
      }

      // Trusted Persons
      if (trustedPersons.length > 0) {
        addSection('Vertrauenspersonen')
        trustedPersons.forEach((person) => {
          const accessLabel = person.access_level === 'immediate' ? 'Sofort' : 
                             person.access_level === 'emergency' ? 'Notfall' : 'Nach Bestätigung'
          doc.text(`• ${person.name} (${person.relationship})`, 14, yPos); yPos += 5
          doc.text(`  E-Mail: ${person.email}, Zugriff: ${accessLabel}`, 14, yPos); yPos += 7
        })
        yPos += 10
      }

      // Documents by Category
      addSection('Dokumente nach Kategorien')
      yPos += 5
      
      Object.entries(DOCUMENT_CATEGORIES).forEach(([key, category]) => {
        const categoryDocs = documents.filter(d => d.category === key)
        if (categoryDocs.length > 0) {
          if (yPos > 250) {
            doc.addPage()
            yPos = 20
          }
          
          doc.setFont('helvetica', 'bold')
          doc.text(`${category.name} (${categoryDocs.length})`, 14, yPos)
          doc.setFont('helvetica', 'normal')
          yPos += 6
          
          categoryDocs.forEach((docItem) => {
            if (yPos > 270) {
              doc.addPage()
              yPos = 20
            }
            let docText = `• ${docItem.title}`
            if (docItem.expiry_date) {
              docText += ` (gültig bis: ${formatDate(docItem.expiry_date)})`
            }
            doc.text(docText, 18, yPos)
            yPos += 5
          })
          yPos += 5
        }
      })

      // Footer on last page
      const pageCount = doc.internal.pages.length - 1
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(
          `Seite ${i} von ${pageCount} - Lebensordner Digital - Vertraulich`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }

      // Save
      doc.save(`lebensordner-uebersicht-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('PDF generation error:', error)
      alert('Fehler beim Erstellen der PDF. Bitte versuchen Sie es erneut.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateFullBackup = async () => {
    setIsBackingUp(true)
    setBackupProgress(0)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      const zip = new JSZip()
      
      // Create data folder
      const dataFolder = zip.folder('daten')
      
      // Add profile data
      setBackupProgress(10)
      dataFolder?.file('profil.json', JSON.stringify(profile, null, 2))
      
      // Add documents metadata
      setBackupProgress(20)
      dataFolder?.file('dokumente.json', JSON.stringify(documents, null, 2))
      
      // Add trusted persons
      setBackupProgress(30)
      dataFolder?.file('vertrauenspersonen.json', JSON.stringify(trustedPersons, null, 2))
      
      // Add emergency contacts
      setBackupProgress(40)
      dataFolder?.file('notfallkontakte.json', JSON.stringify(emergencyContacts, null, 2))
      
      // Add medical info
      setBackupProgress(50)
      dataFolder?.file('medizinische-infos.json', JSON.stringify(medicalInfo, null, 2))
      
      // Add reminders
      setBackupProgress(55)
      dataFolder?.file('erinnerungen.json', JSON.stringify(reminders, null, 2))
      
      // Download all document files
      const filesFolder = zip.folder('dateien')
      const totalDocs = documents.length
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]
        const progress = 60 + ((i / totalDocs) * 35)
        setBackupProgress(Math.round(progress))
        
        try {
          const { data: fileData, error } = await supabase.storage
            .from('documents')
            .download(`${user.id}/${doc.id}/${doc.file_name}`)
          
          if (fileData && !error) {
            const categoryName = DOCUMENT_CATEGORIES[doc.category]?.name || doc.category
            const safeFileName = doc.file_name.replace(/[^a-zA-Z0-9.-]/g, '_')
            filesFolder?.file(`${categoryName}/${doc.title}_${safeFileName}`, fileData)
          }
        } catch (err) {
          console.warn(`Could not download file: ${doc.file_name}`, err)
        }
      }
      
      // Add README
      setBackupProgress(98)
      const readmeContent = `# Lebensordner Backup
      
Erstellt am: ${new Date().toLocaleString('de-DE')}
Benutzer: ${profile?.email}

## Inhalt

### /daten
- profil.json - Ihre Profildaten
- dokumente.json - Liste aller Dokumente
- vertrauenspersonen.json - Ihre Vertrauenspersonen
- notfallkontakte.json - Notfallkontakte
- medizinische-infos.json - Medizinische Informationen
- erinnerungen.json - Ihre Erinnerungen

### /dateien
Alle hochgeladenen Dokumente, sortiert nach Kategorie.

## Hinweis
Dieses Backup enthält vertrauliche Informationen. 
Bewahren Sie es sicher auf und löschen Sie es nach dem Import.
`
      zip.file('README.md', readmeContent)
      
      // Generate zip
      setBackupProgress(100)
      const content = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })
      
      // Download
      const fileName = `lebensordner-backup-${new Date().toISOString().split('T')[0]}.zip`
      saveAs(content, fileName)
      
    } catch (error) {
      console.error('Backup error:', error)
      alert('Fehler beim Erstellen des Backups. Bitte versuchen Sie es erneut.')
    } finally {
      setIsBackingUp(false)
      setBackupProgress(0)
    }
  }

  const handlePrint = () => {
    window.print()
  }

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
          Export & Drucken
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Erstellen Sie eine Übersicht Ihrer wichtigen Informationen als PDF oder drucken Sie diese aus
        </p>
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mb-4">
              <FileDown className="w-6 h-6 text-sage-600" />
            </div>
            <CardTitle>PDF-Export</CardTitle>
            <CardDescription>
              Laden Sie eine vollständige Übersicht als PDF-Datei herunter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={generatePDF} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  PDF wird erstellt...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF herunterladen
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mb-4">
              <Printer className="w-6 h-6 text-sage-600" />
            </div>
            <CardTitle>Drucken</CardTitle>
            <CardDescription>
              Drucken Sie die Übersicht direkt aus Ihrem Browser
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handlePrint} variant="outline" className="w-full">
              <Printer className="mr-2 h-4 w-4" />
              Seite drucken
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Full Backup Section */}
      <Card className="border-sage-200 bg-sage-50/50">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-sage-600 flex items-center justify-center">
              <Archive className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle>Vollständiges Backup</CardTitle>
              <CardDescription>
                Laden Sie alle Ihre Daten und Dokumente als ZIP-Archiv herunter
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2 text-warmgray-600">
              <CheckCircle2 className="w-4 h-4 text-sage-600" />
              <span>Alle Dokumente</span>
            </div>
            <div className="flex items-center gap-2 text-warmgray-600">
              <CheckCircle2 className="w-4 h-4 text-sage-600" />
              <span>Profildaten</span>
            </div>
            <div className="flex items-center gap-2 text-warmgray-600">
              <CheckCircle2 className="w-4 h-4 text-sage-600" />
              <span>Vertrauenspersonen</span>
            </div>
            <div className="flex items-center gap-2 text-warmgray-600">
              <CheckCircle2 className="w-4 h-4 text-sage-600" />
              <span>Notfallinformationen</span>
            </div>
          </div>

          {isBackingUp && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-warmgray-600">Backup wird erstellt...</span>
                <span className="font-medium text-sage-700">{backupProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-warmgray-200 overflow-hidden">
                <div 
                  className="h-full bg-sage-600 transition-all duration-300"
                  style={{ width: `${backupProgress}%` }}
                />
              </div>
            </div>
          )}

          <Button 
            onClick={generateFullBackup} 
            disabled={isBackingUp}
            className="w-full md:w-auto"
          >
            {isBackingUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Backup wird erstellt...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Vollständiges Backup herunterladen
              </>
            )}
          </Button>

          <p className="text-xs text-warmgray-500">
            Das Backup enthält alle Ihre Daten im JSON-Format sowie alle hochgeladenen Dateien. 
            Bewahren Sie es an einem sicheren Ort auf.
          </p>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="print:shadow-none print:border-none">
        <CardHeader>
          <CardTitle>Vorschau</CardTitle>
          <CardDescription>
            So wird Ihre Übersicht aussehen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-sage-50">
              <FileText className="w-6 h-6 text-sage-600 mx-auto mb-2" />
              <p className="text-2xl font-semibold text-warmgray-900">{documents.length}</p>
              <p className="text-sm text-warmgray-500">Dokumente</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-sage-50">
              <Users className="w-6 h-6 text-sage-600 mx-auto mb-2" />
              <p className="text-2xl font-semibold text-warmgray-900">{trustedPersons.length}</p>
              <p className="text-sm text-warmgray-500">Vertrauenspersonen</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-sage-50">
              <Heart className="w-6 h-6 text-sage-600 mx-auto mb-2" />
              <p className="text-2xl font-semibold text-warmgray-900">{emergencyContacts.length}</p>
              <p className="text-sm text-warmgray-500">Notfall-Kontakte</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-sage-50">
              <Shield className="w-6 h-6 text-sage-600 mx-auto mb-2" />
              <p className="text-2xl font-semibold text-warmgray-900">
                {Object.keys(DOCUMENT_CATEGORIES).filter(key => 
                  documents.some(d => d.category === key)
                ).length}
              </p>
              <p className="text-sm text-warmgray-500">Kategorien befüllt</p>
            </div>
          </div>

          <Separator />

          {/* Personal Data */}
          <div>
            <h3 className="font-semibold text-warmgray-900 mb-3">Persönliche Daten</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-warmgray-500">Name:</span>
                <span className="ml-2 text-warmgray-900">{profile?.full_name || '-'}</span>
              </div>
              <div>
                <span className="text-warmgray-500">E-Mail:</span>
                <span className="ml-2 text-warmgray-900">{profile?.email || '-'}</span>
              </div>
              <div>
                <span className="text-warmgray-500">Telefon:</span>
                <span className="ml-2 text-warmgray-900">{profile?.phone || '-'}</span>
              </div>
            </div>
          </div>

          {/* Document Categories */}
          <div>
            <h3 className="font-semibold text-warmgray-900 mb-3">Dokumenten-Übersicht</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => {
                const count = documents.filter(d => d.category === key).length
                return (
                  <div 
                    key={key} 
                    className={`p-3 rounded-lg border ${count > 0 ? 'border-sage-200 bg-sage-50' : 'border-warmgray-200 bg-warmgray-50'}`}
                  >
                    <p className="text-sm font-medium text-warmgray-900">{category.name}</p>
                    <p className={`text-lg font-semibold ${count > 0 ? 'text-sage-600' : 'text-warmgray-400'}`}>
                      {count}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trusted Persons */}
          {trustedPersons.length > 0 && (
            <div>
              <h3 className="font-semibold text-warmgray-900 mb-3">Vertrauenspersonen</h3>
              <div className="space-y-2">
                {trustedPersons.map((person) => (
                  <div key={person.id} className="flex items-center justify-between p-3 rounded-lg bg-warmgray-50">
                    <div>
                      <p className="font-medium text-warmgray-900">{person.name}</p>
                      <p className="text-sm text-warmgray-500">{person.relationship} • {person.email}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-sage-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Note */}
      <Card className="border-amber-200 bg-amber-50 print:hidden">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Shield className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-warmgray-900 mb-1">Hinweis zur Sicherheit</p>
              <p className="text-sm text-warmgray-600">
                Das exportierte PDF enthält sensible Daten. Bewahren Sie es sicher auf und 
                teilen Sie es nur mit vertrauenswürdigen Personen. Löschen Sie digitale Kopien 
                nach dem Drucken, wenn möglich.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
