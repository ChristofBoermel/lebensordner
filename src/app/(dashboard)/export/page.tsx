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
  HardDrive,
  QrCode,
  Info,
  Smartphone,
  CreditCard,
  AlertCircle,
  X
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'
import { formatDate } from '@/lib/utils'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import QRCode from 'qrcode'

interface DocumentRow {
  id: string
  category: DocumentCategory
  title: string
  notes: string | null
  file_name: string
  file_path: string | null
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

interface EmergencyContactRow {
  id: string
  name: string
  phone: string
  email: string | null
  relationship: string
  is_primary: boolean
}

interface MedicalInfoRow {
  blood_type: string | null
  allergies: string[]
  medications: string[]
  conditions: string[]
  doctor_name: string | null
  doctor_phone: string | null
  insurance_number: string | null
  organ_donor: boolean | null
}

interface AdvanceDirectivesRow {
  has_patient_decree: boolean
  has_power_of_attorney: boolean
  has_care_directive: boolean
  has_bank_power_of_attorney: boolean
}

export default function ExportPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [backupProgress, setBackupProgress] = useState(0)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [trustedPersons, setTrustedPersons] = useState<TrustedPersonRow[]>([])
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactRow[]>([])
  const [medicalInfo, setMedicalInfo] = useState<MedicalInfoRow | null>(null)
  const [advanceDirectives, setAdvanceDirectives] = useState<AdvanceDirectivesRow | null>(null)
  const [reminders, setReminders] = useState<any[]>([])
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Fetch decrypted emergency/medical data from API (handles server-side decryption)
      const notfallResponse = await fetch('/api/notfall')
      if (!notfallResponse.ok) {
        if (notfallResponse.status === 401) {
          setNotification({ type: 'error', message: 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.' })
          return
        }
        console.error('Notfall API error:', notfallResponse.status)
      }
      const notfallData = notfallResponse.ok ? await notfallResponse.json() : {}

      // Fetch decrypted profile fields from API (phone, address are encrypted in DB)
      const profileResponse = await fetch('/api/profile')
      const decryptedProfile = profileResponse.ok ? (await profileResponse.json()).profile : null

      // Fetch basic profile data (full_name, email are not encrypted)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile({
          full_name: profileData.full_name,
          email: profileData.email,
          phone: decryptedProfile?.phone || null,
          address: decryptedProfile?.address || null,
        })
      }

      // Set decrypted emergency data from API
      if (notfallData.emergencyContacts) {
        setEmergencyContacts(notfallData.emergencyContacts)
      }
      if (notfallData.medicalInfo) {
        setMedicalInfo(notfallData.medicalInfo)
      }
      if (notfallData.directives) {
        setAdvanceDirectives(notfallData.directives)
      }

      // Fetch documents (not encrypted, direct Supabase query is fine)
      const { data: docsData } = await supabase
        .from('documents')
        .select('id, category, title, notes, file_name, file_path, created_at, expiry_date')
        .eq('user_id', user.id)
        .order('category') as { data: DocumentRow[] | null }

      if (docsData) setDocuments(docsData)

      // Fetch trusted persons (not encrypted)
      const { data: trustedData } = await supabase
        .from('trusted_persons')
        .select('id, name, email, phone, relationship, access_level')
        .eq('user_id', user.id)
        .eq('is_active', true) as { data: TrustedPersonRow[] | null }

      if (trustedData) setTrustedPersons(trustedData)

      // Fetch reminders
      const { data: remindersData } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)

      if (remindersData) setReminders(remindersData)
    } catch (error) {
      console.error('Error fetching export data:', error)
      setNotification({ type: 'error', message: 'Fehler beim Laden der Daten. Bitte versuchen Sie es erneut.' })
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-dismiss notifications after 6 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Generate emergency QR code with human-readable German text
  const generateEmergencyQR = useCallback(async () => {
    setIsGeneratingQR(true)
    try {
      // Build human-readable German text block
      const lines: string[] = []
      lines.push('NOTFALL-INFORMATIONEN')
      lines.push('')

      // Personal info
      if (profile?.full_name) {
        lines.push(`Name: ${profile.full_name}`)
      }

      // Emergency contacts
      if (emergencyContacts.length > 0) {
        lines.push('')
        lines.push('Notfall-Kontakte:')
        emergencyContacts.slice(0, 2).forEach(c => {
          lines.push(`- ${c.name} (${c.relationship}): ${c.phone}`)
        })
      }

      // Medical info
      if (medicalInfo) {
        if (medicalInfo.blood_type) {
          lines.push('')
          lines.push(`Blutgruppe: ${medicalInfo.blood_type}`)
        }
        if (medicalInfo.allergies?.length > 0) {
          lines.push(`Allergien: ${medicalInfo.allergies.join(', ')}`)
        }
        if (medicalInfo.medications?.length > 0) {
          lines.push(`Medikamente: ${medicalInfo.medications.join(', ')}`)
        }
        if (medicalInfo.conditions?.length > 0) {
          lines.push(`Vorerkrankungen: ${medicalInfo.conditions.join(', ')}`)
        }
        if (medicalInfo.doctor_name) {
          let doctorLine = `Hausarzt: ${medicalInfo.doctor_name}`
          if (medicalInfo.doctor_phone) doctorLine += ` (${medicalInfo.doctor_phone})`
          lines.push(doctorLine)
        }
        if (medicalInfo.insurance_number) {
          lines.push(`Versicherungsnummer: ${medicalInfo.insurance_number}`)
        }
        if (medicalInfo.organ_donor !== null) {
          lines.push(`Organspender: ${medicalInfo.organ_donor ? 'Ja' : 'Nein'}`)
        }
      }

      // Advance directives
      if (advanceDirectives) {
        const directives: string[] = []
        if (advanceDirectives.has_patient_decree) directives.push('Patientenverfügung')
        if (advanceDirectives.has_power_of_attorney) directives.push('Vorsorgevollmacht')
        if (advanceDirectives.has_care_directive) directives.push('Betreuungsverfügung')
        if (advanceDirectives.has_bank_power_of_attorney) directives.push('Bankvollmacht')
        if (directives.length > 0) {
          lines.push('')
          lines.push(`Verfügungen: ${directives.join(', ')}`)
        }
      }

      // Generate QR code
      const textData = lines.join('\n')
      const dataUrl = await QRCode.toDataURL(textData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })

      setQrCodeDataUrl(dataUrl)
    } catch (error) {
      console.error('QR generation error:', error)
      setNotification({ type: 'error', message: 'Fehler beim Erstellen des QR-Codes. Bitte versuchen Sie es erneut.' })
    } finally {
      setIsGeneratingQR(false)
    }
  }, [profile, emergencyContacts, medicalInfo, advanceDirectives])

  // Auto-generate QR code when data is loaded
  useEffect(() => {
    if (!isLoading && (emergencyContacts.length > 0 || medicalInfo)) {
      generateEmergencyQR()
    }
  }, [isLoading, emergencyContacts, medicalInfo, generateEmergencyQR])

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
      try {
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
      } catch (sectionError) {
        console.error('PDF section error (Persönliche Daten):', sectionError)
        yPos += 10
      }

      // Emergency Contacts
      try {
        if (emergencyContacts.length > 0) {
          addSection('Notfall-Kontakte')
          emergencyContacts.forEach((contact: any) => {
            doc.text(`• ${contact.name} (${contact.relationship}): ${contact.phone}`, 14, yPos)
            yPos += 6
          })
          yPos += 10
        }
      } catch (sectionError) {
        console.error('PDF section error (Notfall-Kontakte):', sectionError)
        yPos += 10
      }

      // Medical Info
      try {
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
      } catch (sectionError) {
        console.error('PDF section error (Medizinische Informationen):', sectionError)
        yPos += 10
      }

      // Trusted Persons
      try {
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
      } catch (sectionError) {
        console.error('PDF section error (Vertrauenspersonen):', sectionError)
        yPos += 10
      }

      // Documents by Category
      try {
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
      } catch (sectionError) {
        console.error('PDF section error (Dokumente):', sectionError)
      }

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
      setNotification({ type: 'error', message: 'Fehler beim Erstellen der PDF. Bitte versuchen Sie es erneut.' })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateFullBackup = async () => {
    setIsBackingUp(true)
    setBackupProgress(0)
    const failedFiles: string[] = []

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setNotification({ type: 'error', message: 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.' })
        return
      }

      const zip = new JSZip()

      // Create data folder
      const dataFolder = zip.folder('daten')

      // Add profile data (already decrypted via API)
      setBackupProgress(10)
      dataFolder?.file('profil.json', JSON.stringify(profile, null, 2))

      // Add documents metadata
      setBackupProgress(20)
      dataFolder?.file('dokumente.json', JSON.stringify(documents, null, 2))

      // Add trusted persons
      setBackupProgress(30)
      dataFolder?.file('vertrauenspersonen.json', JSON.stringify(trustedPersons, null, 2))

      // Add emergency contacts (already decrypted via API)
      setBackupProgress(40)
      dataFolder?.file('notfallkontakte.json', JSON.stringify(emergencyContacts, null, 2))

      // Add medical info (already decrypted via API)
      setBackupProgress(50)
      dataFolder?.file('medizinische-infos.json', JSON.stringify(medicalInfo, null, 2))

      // Add reminders
      setBackupProgress(55)
      dataFolder?.file('erinnerungen.json', JSON.stringify(reminders, null, 2))

      // Download all document files
      const filesFolder = zip.folder('dateien')
      const totalDocs = documents.length
      let successCount = 0

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]
        const progress = 60 + ((i / totalDocs) * 35)
        setBackupProgress(Math.round(progress))

        try {
          const filePath = doc.file_path || `${user.id}/${doc.id}/${doc.file_name}`
          const { data: fileData, error } = await supabase.storage
            .from('documents')
            .download(filePath)

          if (fileData && !error) {
            const categoryName = DOCUMENT_CATEGORIES[doc.category]?.name || doc.category
            const safeFileName = doc.file_name.replace(/[^a-zA-Z0-9.-]/g, '_')
            filesFolder?.file(`${categoryName}/${doc.title}_${safeFileName}`, fileData)
            successCount++
          } else {
            const errorMsg = error?.message || 'Unbekannter Fehler'
            console.warn(`Datei nicht herunterladbar: ${doc.file_name} (${errorMsg})`)
            failedFiles.push(doc.file_name)
          }
        } catch (err) {
          console.warn(`Fehler beim Download: ${doc.file_name}`, err)
          failedFiles.push(doc.file_name)
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
${failedFiles.length > 0 ? `\n### Fehlende Dateien\nDie folgenden Dateien konnten nicht heruntergeladen werden:\n${failedFiles.map(f => `- ${f}`).join('\n')}` : ''}

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

      // Show summary notification
      if (failedFiles.length > 0) {
        setNotification({
          type: 'warning',
          message: `Backup erstellt. ${successCount} von ${totalDocs} Dateien erfolgreich. ${failedFiles.length} Datei(en) konnten nicht heruntergeladen werden.`,
        })
      } else if (totalDocs > 0) {
        setNotification({
          type: 'success',
          message: `Backup erfolgreich erstellt mit allen ${totalDocs} Dateien.`,
        })
      } else {
        setNotification({
          type: 'success',
          message: 'Backup erfolgreich erstellt.',
        })
      }

    } catch (error) {
      console.error('Backup error:', error)
      setNotification({ type: 'error', message: 'Fehler beim Erstellen des Backups. Bitte versuchen Sie es erneut.' })
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
      {/* Print-only header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold">Lebensordner - Notfall-Informationen</h1>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 print:hidden ${
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
          notification.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-green-50 border-green-200 text-green-900'
        }`}>
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          ) : notification.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm flex-1">{notification.message}</p>
          <button
            onClick={() => setNotification(null)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
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
            <Button onClick={generatePDF} disabled={isGenerating} className="w-full print:hidden">
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
            <Button onClick={handlePrint} variant="outline" className="w-full print:hidden">
              <Printer className="mr-2 h-4 w-4" />
              Seite drucken
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Full Backup Section */}
      <Card className="border-sage-200 bg-sage-50/50 print:hidden">
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
            className="w-full md:w-auto print:hidden"
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

      {/* Emergency QR Code Section */}
      <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-900">Notfall-QR-Code</CardTitle>
              <CardDescription>
                Alle wichtigen Notfallinformationen in einem QR-Code - offline lesbar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code Display */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center">
              {isGeneratingQR ? (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-warmgray-100 rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-warmgray-400" />
                </div>
              ) : qrCodeDataUrl ? (
                <div className="p-3 bg-white rounded-lg shadow-sm border border-warmgray-200 print:shadow-none" data-qr-code>
                  <img
                    src={qrCodeDataUrl}
                    alt="Notfall QR-Code"
                    className="w-[200px] h-[200px] qr-code"
                    id="emergency-qr-code"
                  />
                </div>
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-warmgray-100 rounded-lg text-warmgray-500 text-sm text-center p-4">
                  <div>
                    <QrCode className="w-10 h-10 mx-auto mb-2 text-warmgray-400" />
                    Keine Notfalldaten vorhanden
                  </div>
                </div>
              )}
              <Button
                onClick={generateEmergencyQR}
                variant="outline"
                size="sm"
                className="mt-3 print:hidden"
                disabled={isGeneratingQR}
              >
                {isGeneratingQR ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="mr-2 h-4 w-4" />
                )}
                QR-Code aktualisieren
              </Button>
            </div>

            {/* QR Code Content Summary */}
            <div className="flex-1 space-y-3">
              <h4 className="font-medium text-warmgray-900">Enthaltene Informationen:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${emergencyContacts.length > 0 ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={emergencyContacts.length > 0 ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Notfallkontakte ({emergencyContacts.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.blood_type ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.blood_type ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Blutgruppe {medicalInfo?.blood_type ? `(${medicalInfo.blood_type})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.allergies?.length ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.allergies?.length ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Allergien ({medicalInfo?.allergies?.length || 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.medications?.length ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.medications?.length ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Medikamente ({medicalInfo?.medications?.length || 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.conditions?.length ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.conditions?.length ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Vorerkrankungen ({medicalInfo?.conditions?.length || 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.organ_donor !== null ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.organ_donor !== null ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Organspende {medicalInfo?.organ_donor !== null ? (medicalInfo?.organ_donor ? '(Ja)' : '(Nein)') : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${advanceDirectives?.has_patient_decree || advanceDirectives?.has_power_of_attorney ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={advanceDirectives?.has_patient_decree || advanceDirectives?.has_power_of_attorney ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Vollmachten (Ja/Nein)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.doctor_name ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.doctor_name ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    Hausarzt
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator className="print:hidden" />

          {/* Instructions */}
          <div className="bg-white rounded-lg p-4 border border-warmgray-200 print:hidden">
            <div className="flex items-start gap-3 mb-4">
              <Info className="w-5 h-5 text-sage-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-warmgray-900">So nutzen Sie den Notfall-QR-Code</h4>
                <p className="text-sm text-warmgray-600 mt-1">
                  Der QR-Code enthält Ihre wichtigsten Notfallinformationen und kann von jedem Smartphone gescannt werden - auch ohne Internet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-warmgray-50">
                <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sage-700 font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-warmgray-900 text-sm">QR-Code drucken</p>
                  <p className="text-xs text-warmgray-500 mt-0.5">
                    Rechtsklick auf den QR-Code → "Bild speichern" → Ausdrucken in Originalgröße
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-warmgray-50">
                <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sage-700 font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-warmgray-900 text-sm">Ausschneiden</p>
                  <p className="text-xs text-warmgray-500 mt-0.5">
                    Den QR-Code passend ausschneiden (ca. 3x3 cm)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-warmgray-50">
                <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sage-700 font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-warmgray-900 text-sm">Aufkleben</p>
                  <p className="text-xs text-warmgray-500 mt-0.5">
                    Auf der Rückseite Ihrer Krankenkassenkarte oder im Portemonnaie befestigen
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Print Tips */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 print:hidden">
            <CreditCard className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-amber-900 text-sm">Tipp: Ideale Stellen für den QR-Code</h4>
              <ul className="text-xs text-amber-800 mt-1 space-y-1">
                <li>• <strong>Krankenkassenkarte</strong> - Wird bei jedem Arztbesuch vorgelegt</li>
                <li>• <strong>Personalausweis-Hülle</strong> - Immer dabei im Notfall</li>
                <li>• <strong>Smartphone-Hülle</strong> - Leicht zugänglich für Ersthelfer</li>
                <li>• <strong>Kühlschrank</strong> - Für Notfälle zu Hause (Rettungskräfte schauen oft dort)</li>
              </ul>
            </div>
          </div>

          {/* Scan Demo */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-sage-50 border border-sage-200 print:hidden">
            <Smartphone className="w-8 h-8 text-sage-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-warmgray-700">
                <strong>Zum Lesen:</strong> Öffnen Sie die Kamera-App Ihres Smartphones und richten Sie sie auf den QR-Code.
                Die Notfallinformationen werden automatisch angezeigt.
              </p>
            </div>
          </div>
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

      {/* Print-only footer with date */}
      <div className="hidden print:block print-date mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-600">
        Gedruckt am: {new Date().toLocaleDateString('de-DE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>

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
