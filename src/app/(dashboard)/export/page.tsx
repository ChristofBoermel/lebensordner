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
import { useVault } from '@/lib/vault/VaultContext'
import { VaultUnlockModal } from '@/components/vault/VaultUnlockModal'
import type { Medication } from '@/types/medication'

interface DocumentRow {
  id: string
  category: DocumentCategory
  title: string
  notes: string | null
  file_name: string
  file_path: string | null
  created_at: string
  expiry_date: string | null
  is_encrypted: boolean
  wrapped_dek: string | null
  file_iv: string | null
  title_encrypted: string | null
  notes_encrypted: string | null
  file_name_encrypted: string | null
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
  date_of_birth: string | null
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
  allergies: string[]
  medications: Medication[]
  medication_plan_updated_at: string | null
  conditions: string[]
  vaccinations?: Array<{ name: string; month?: number | null; year: number }>
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
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false)
  const vaultContext = useVault()

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

      // Fetch vaccinations
      const vaccinationsResponse = await fetch('/api/vaccinations')
      const vaccinationsData = vaccinationsResponse.ok ? await vaccinationsResponse.json() : {}
      const savedVaccinations: Array<{ name: string; month: number | null; year: number }> =
        (vaccinationsData.vaccinations || [])
          .filter((v: any) => v.year !== null)
          .map((v: any) => ({ name: v.name as string, month: (v.month ?? null) as number | null, year: v.year as number }))

      // Fetch decrypted profile fields from API (phone, address are encrypted in DB)
      const profileResponse = await fetch('/api/profile')
      const decryptedProfile = profileResponse.ok ? (await profileResponse.json()).profile : null

      // Fetch basic profile data (full_name, email are not encrypted)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, date_of_birth')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile({
          full_name: profileData.full_name,
          email: profileData.email,
          date_of_birth: profileData.date_of_birth,
          phone: decryptedProfile?.phone || null,
          address: decryptedProfile?.address || null,
        })
      }

      // Set decrypted emergency data from API
      if (notfallData.emergencyContacts) {
        setEmergencyContacts(notfallData.emergencyContacts)
      }
      if (notfallData.medicalInfo) {
        setMedicalInfo({ ...notfallData.medicalInfo, vaccinations: savedVaccinations })
      } else if (savedVaccinations.length > 0) {
        setMedicalInfo({
          allergies: [],
          medications: [],
          medication_plan_updated_at: null,
          conditions: [],
          vaccinations: savedVaccinations,
          doctor_name: null,
          doctor_phone: null,
          insurance_number: null,
          organ_donor: null,
        })
      }
      if (notfallData.directives) {
        setAdvanceDirectives(notfallData.directives)
      }

      // Fetch documents (not encrypted, direct Supabase query is fine)
      const { data: docsData } = await supabase
        .from('documents')
        .select('id, category, title, notes, file_name, file_path, created_at, expiry_date, is_encrypted, wrapped_dek, file_iv, title_encrypted, notes_encrypted, file_name_encrypted')
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
      const primaryContact = emergencyContacts.find((contact) => contact.is_primary) || emergencyContacts[0]
      const contactValue = primaryContact
        ? primaryContact.phone
          ? `${primaryContact.name}, ${primaryContact.phone}`
          : primaryContact.name
            ? primaryContact.name
            : 'Nicht angegeben'
        : 'Nicht angegeben'
      const birthDateValue = profile?.date_of_birth
        ? formatDate(profile.date_of_birth)
        : 'Nicht angegeben'
      const doctorValue = (medicalInfo?.doctor_name || medicalInfo?.doctor_phone)
        ? `${medicalInfo?.doctor_name || 'Nicht angegeben'}${medicalInfo?.doctor_phone ? `, ${medicalInfo.doctor_phone}` : ''}`
        : 'Nicht angegeben'
      const allergiesValue = medicalInfo?.allergies?.length
        ? medicalInfo.allergies.join(', ')
        : 'Keine'
      const vaccinationsValue = medicalInfo?.vaccinations?.length
        ? medicalInfo.vaccinations.map((vaccination) => `${vaccination.name} ${vaccination.year}`).join(', ')
        : 'Keine'

      const lines: string[] = [
        'NOTFALL-INFO',
        `Name: ${profile?.full_name || 'Nicht angegeben'}`,
        `Geburtsdatum: ${birthDateValue}`,
        `Notfallkontakt: ${contactValue}`,
        `Arzt: ${doctorValue}`,
        `Allergien: ${allergiesValue}`,
      ]

      // Medication timestamp line
      if (medicalInfo?.medication_plan_updated_at) {
        const d = new Date(medicalInfo.medication_plan_updated_at)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        lines.push(`Medikationsplan: Stand ${day}.${month}.${year}`)
      }

      // Per-medication lines
      if (medicalInfo?.medications?.length) {
        for (const med of medicalInfo.medications) {
          const name = med.wirkstoff && med.wirkstoff.trim()
            ? med.wirkstoff
            : med.pzn
              ? `PZN: ${med.pzn}`
              : null
          if (!name) continue
          const parts: string[] = [name]
          if (med.staerke) parts.push(med.staerke)
          const line = med.grund
            ? `- ${parts.join(' ')} (${med.grund})`
            : `- ${parts.join(' ')}`
          lines.push(line)
        }
      }

      lines.push(`Impfungen: ${vaccinationsValue}`)

      // Generate QR code — truncate medication lines if content exceeds 900 chars
      let textData = lines.join('\n')
      if (textData.length > 900) {
        const medLineStart = lines.findIndex(l => l.startsWith('Medikationsplan: Stand') || l.startsWith('- '))
        if (medLineStart !== -1) {
          const before = lines.slice(0, medLineStart)
          const medLines = lines.slice(medLineStart, lines.length - 1) // exclude last (Impfungen)
          const after = [lines[lines.length - 1]]
          const kept: string[] = []
          let droppedCount = 0
          for (const ml of medLines) {
            const candidate = [...before, ...kept, ml, ...after].join('\n')
            if (candidate.length <= 880) {
              kept.push(ml)
            } else {
              droppedCount++
            }
          }
          if (droppedCount > 0) {
            kept.push(`+ ${droppedCount} weitere Medikamente (siehe App)`)
          }
          textData = [...before, ...kept, ...after].join('\n')
        }
      }
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
  }, [profile, emergencyContacts, medicalInfo])

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
        if (medicalInfo && (
          medicalInfo.allergies?.length > 0 ||
          medicalInfo.medications?.length > 0 ||
          medicalInfo.conditions?.length > 0 ||
          medicalInfo.doctor_name ||
          medicalInfo.doctor_phone ||
          medicalInfo.insurance_number ||
          medicalInfo.organ_donor !== null ||
          (medicalInfo.vaccinations?.length ?? 0) > 0
        )) {
          addSection('Medizinische Informationen')
          if (medicalInfo.allergies?.length > 0) {
            doc.text(`Allergien: ${medicalInfo.allergies.join(', ')}`, 14, yPos); yPos += 6
          }
          if (medicalInfo.medications?.length > 0) {
            doc.text('Medikamente:', 14, yPos); yPos += 6
            for (const med of medicalInfo.medications) {
              const name = med.wirkstoff || (med.pzn ? `PZN: ${med.pzn}` : '?')
              const detail = [med.staerke, med.grund].filter(Boolean).join(', ')
              const line = detail ? `• ${name} (${detail})` : `• ${name}`
              if (yPos > 270) { doc.addPage(); yPos = 20 }
              doc.text(line, 18, yPos); yPos += 6
            }
          }
          if ((medicalInfo.conditions?.length ?? 0) > 0) {
            doc.text(`Vorerkrankungen: ${medicalInfo.conditions.join(', ')}`, 14, yPos); yPos += 6
          }
          if ((medicalInfo.vaccinations?.length ?? 0) > 0) {
            doc.text('Impfungen:', 14, yPos); yPos += 6
            for (const vac of medicalInfo.vaccinations ?? []) {
              const date = vac.month ? `${vac.month}/${vac.year}` : `${vac.year}`
              if (yPos > 270) { doc.addPage(); yPos = 20 }
              doc.text(`• ${vac.name} (${date})`, 18, yPos); yPos += 6
            }
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
    const hasEncryptedDocs = documents.some(d => d.is_encrypted)
    if (hasEncryptedDocs && !vaultContext.isUnlocked) {
      setIsVaultModalOpen(true)
      setIsBackingUp(false)
      return
    }
    const masterKey = vaultContext.masterKey

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
      const patchedDocuments: DocumentRow[] = []

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
            if (doc.is_encrypted && masterKey && doc.wrapped_dek && doc.file_iv) {
              const { unwrapKey, decryptFile, decryptField } = await import('@/lib/security/document-e2ee')
              const encBuffer = await fileData.arrayBuffer()
              const dek = await unwrapKey(doc.wrapped_dek, masterKey, 'AES-GCM')
              const plainBuffer = await decryptFile(encBuffer, dek, doc.file_iv)
              const realFileName = doc.file_name_encrypted
                ? await decryptField(doc.file_name_encrypted, dek).catch(() => doc.file_name)
                : doc.file_name
              const realTitle = doc.title_encrypted
                ? await decryptField(doc.title_encrypted, dek).catch(() => doc.title)
                : doc.title
              const safeFileName = realFileName.replace(/[^a-zA-Z0-9.-]/g, '_')
              filesFolder?.file(`${categoryName}/${realTitle}_${safeFileName}`, plainBuffer)
              patchedDocuments.push({ ...doc, title: realTitle, file_name: realFileName })
            } else {
              const safeFileName = doc.file_name.replace(/[^a-zA-Z0-9.-]/g, '_')
              filesFolder?.file(`${categoryName}/${doc.title}_${safeFileName}`, fileData)
              patchedDocuments.push(doc)
            }
            successCount++
          } else {
            const errorMsg = error?.message || 'Unbekannter Fehler'
            console.warn(`Datei nicht herunterladbar: ${doc.file_name} (${errorMsg})`)
            failedFiles.push(doc.file_name)
            patchedDocuments.push(doc)
          }
        } catch (err) {
          console.warn(`Fehler beim Download: ${doc.file_name}`, err)
          failedFiles.push(doc.file_name)
          patchedDocuments.push(doc)
        }
      }

      dataFolder?.file('dokumente.json', JSON.stringify(patchedDocuments, null, 2))

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
Alle Dokumente wurden vor dem Export entschlüsselt und liegen im Klartext vor.
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
              <p className="text-sm text-warmgray-500 text-center mt-1">
                Scannen Sie diesen Code mit der Kamera-App Ihres Smartphones
              </p>
            </div>

            {/* QR Code Content Summary */}
            <div className="flex-1 space-y-3">
              <h4 className="font-medium text-warmgray-900">Enthaltene Informationen:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${profile?.full_name ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={profile?.full_name ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    {profile?.full_name ? `Name: ${profile.full_name}` : 'Name: Nicht angegeben'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${profile?.date_of_birth ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={profile?.date_of_birth ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    {profile?.date_of_birth ? `Geburtsdatum: ${formatDate(profile.date_of_birth)}` : 'Geburtsdatum: Nicht angegeben'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${emergencyContacts.length > 0 ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={emergencyContacts.length > 0 ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    {emergencyContacts.length > 0
                      ? (() => {
                          const primaryContact = emergencyContacts.find(c => c.is_primary) || emergencyContacts[0]
                          return `Notfallkontakt: ${primaryContact.name}${primaryContact.phone ? `, ${primaryContact.phone}` : ''}`
                        })()
                      : 'Notfallkontakt: Nicht angegeben'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.doctor_name ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.doctor_name ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    {medicalInfo?.doctor_name
                      ? `Arzt: ${medicalInfo.doctor_name}${medicalInfo.doctor_phone ? `, ${medicalInfo.doctor_phone}` : ''}`
                      : 'Arzt: Nicht angegeben'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.allergies?.length ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.allergies?.length ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    {medicalInfo?.allergies?.length ? `Allergien: ${medicalInfo.allergies.join(', ')}` : 'Allergien: Keine'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.medications?.length ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.medications?.length ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    {medicalInfo?.medications?.length ? `Medikamente: ${medicalInfo.medications.map(m => m.wirkstoff || (m.pzn ? `PZN: ${m.pzn}` : '?')).join(', ')}` : 'Medikamente: Keine'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${medicalInfo?.vaccinations?.length ? 'text-green-600' : 'text-warmgray-300'}`} />
                  <span className={medicalInfo?.vaccinations?.length ? 'text-warmgray-700' : 'text-warmgray-400'}>
                    {medicalInfo?.vaccinations?.length
                      ? `Impfungen: ${medicalInfo.vaccinations.map(v => `${v.name} ${v.year}`).join(', ')}`
                      : 'Impfungen: Keine'}
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

      <VaultUnlockModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
      />
    </div>
  )
}
