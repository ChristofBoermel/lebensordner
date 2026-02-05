'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

async function generateChecklistPDF(userName?: string, userEmail?: string) {
  const jsPDFModule = await import('jspdf')
  const jsPDF = jsPDFModule.default

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  let y = 25

  // Header with sage green accent line
  doc.setDrawColor(93, 107, 93)
  doc.setLineWidth(2)
  doc.line(margin, y, pageWidth - margin, y)
  y += 14

  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text('Lebensordner', pageWidth / 2, y, { align: 'center' })
  y += 12
  doc.setFontSize(18)
  doc.setFont('helvetica', 'normal')
  doc.text('Erste Schritte - Checkliste', pageWidth / 2, y, { align: 'center' })
  y += 14

  // Personalized greeting
  if (userName) {
    doc.setFontSize(13)
    doc.setTextColor(100, 100, 100)
    doc.text(`F\u00fcr: ${userName}`, pageWidth / 2, y, { align: 'center' })
    y += 8
  }

  const dateStr = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.setFontSize(11)
  doc.setTextColor(150, 150, 150)
  doc.text(`Erstellt am ${dateStr}`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 12

  doc.setDrawColor(93, 107, 93)
  doc.setLineWidth(0.5)
  doc.line(margin + 30, y, pageWidth - margin - 30, y)
  y += 16

  // Checklist items
  const tasks = [
    {
      title: 'Profil mit Name und Geburtsdatum ausf\u00fcllen',
      hint: 'Einstellungen \u2192 Profil',
    },
    {
      title: 'Notfallkontakt hinzuf\u00fcgen',
      hint: 'Notfall & Vorsorge \u2192 Kontakte',
    },
    {
      title: 'Erste Dokumente hochladen (z.B. Personalausweis)',
      hint: 'Dokumente \u2192 Hochladen',
    },
    {
      title: 'Vertrauensperson einladen',
      hint: 'Zugriff \u2192 Vertrauenspersonen',
    },
    {
      title: 'Medizinische Informationen eintragen',
      hint: 'Notfall & Vorsorge \u2192 Medizinisch',
    },
    {
      title: 'Erinnerungen f\u00fcr wichtige Dokumente setzen',
      hint: 'Dokumente \u2192 Erinnerung erstellen',
    },
    {
      title: 'Patientenverf\u00fcgung / Vollmachten hinterlegen',
      hint: 'Notfall & Vorsorge \u2192 Vorsorge',
    },
    {
      title: 'Notfall-QR-Code ausdrucken und aufbewahren',
      hint: 'Export \u2192 Notfall-QR-Code',
    },
  ]

  tasks.forEach((task) => {
    // Draw large checkbox
    doc.setDrawColor(93, 107, 93)
    doc.setLineWidth(0.8)
    doc.rect(margin, y - 6, 8, 8)

    // Task title
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(task.title, margin + 14, y + 1)

    // Hint text
    doc.setFontSize(10)
    doc.setTextColor(140, 140, 140)
    doc.text(task.hint, margin + 14, y + 8)
    doc.setTextColor(0, 0, 0)

    y += 22
  })

  // Notes section
  y += 10
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('Eigene Notizen:', margin, y)
  y += 10

  for (let i = 0; i < 6; i++) {
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 14
  }

  // Footer
  doc.setDrawColor(93, 107, 93)
  doc.setLineWidth(0.5)
  doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  const footerText = userEmail
    ? `Lebensordner Digital - ${userEmail}`
    : 'Lebensordner Digital - www.lebensordner.org'
  doc.text(footerText, pageWidth / 2, pageHeight - 20, { align: 'center' })
  doc.text('Vertraulich - Sicher aufbewahren', pageWidth / 2, pageHeight - 14, {
    align: 'center',
  })

  return doc
}

interface DownloadChecklistButtonProps {
  userName?: string
  userEmail?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'onboarding'
  className?: string
  onDownload?: () => void
}

export function DownloadChecklistButton({
  userName,
  userEmail,
  variant = 'outline',
  size = 'onboarding',
  className = '',
  onDownload,
}: DownloadChecklistButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      const doc = await generateChecklistPDF(userName, userEmail)
      const dateStr = new Date().toISOString().split('T')[0]
      doc.save(`lebensordner-checkliste-${dateStr}.pdf`)
      onDownload?.()
    } catch (error) {
      console.error('Checklist PDF generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isGenerating}
      className={className}
    >
      {isGenerating ? (
        <Loader2 className="mr-2 w-5 h-5 animate-spin" />
      ) : (
        <Download className="mr-2 w-5 h-5" />
      )}
      {isGenerating ? 'Wird erstellt...' : 'Checkliste herunterladen'}
    </Button>
  )
}
