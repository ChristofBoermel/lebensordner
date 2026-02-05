'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Loader2 } from 'lucide-react'

export async function generateOnboardingGuidePDF() {
  const jsPDFModule = await import('jspdf')
  const jsPDF = jsPDFModule.default

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  const addFooter = (pageNum: number) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Seite ${pageNum} - Lebensordner Digital - Vertraulich`,
      pageWidth / 2,
      pageHeight - 12,
      { align: 'center' }
    )
    doc.setTextColor(0, 0, 0)
  }

  const addHeading = (text: string, y: number, size: number = 24) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'bold')
    doc.text(text, margin, y)
    return y + size * 0.6
  }

  const addBody = (text: string, y: number, size: number = 14) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, contentWidth)
    doc.text(lines, margin, y)
    return y + lines.length * size * 0.5 + 4
  }

  const addBullet = (text: string, y: number, prefix: string = '\u2192') => {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    const bulletText = `${prefix}  ${text}`
    const lines = doc.splitTextToSize(bulletText, contentWidth - 10)
    doc.text(lines, margin + 5, y)
    return y + lines.length * 8 + 4
  }

  const addGrayBox = (text: string, y: number) => {
    const boxHeight = 14
    doc.setFillColor(245, 245, 240)
    doc.roundedRect(margin, y - 6, contentWidth, boxHeight, 3, 3, 'F')
    doc.setFontSize(12)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    doc.text(text, margin + 6, y + 2)
    doc.setTextColor(0, 0, 0)
    return y + boxHeight + 6
  }

  // === COVER PAGE ===
  let y = 60
  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.text('Lebensordner', pageWidth / 2, y, { align: 'center' })
  y += 16
  doc.setFontSize(20)
  doc.setFont('helvetica', 'normal')
  doc.text('Erste Schritte', pageWidth / 2, y, { align: 'center' })
  y += 24
  doc.setFontSize(14)
  doc.setTextColor(100, 100, 100)
  doc.text('Ihre Schritt-f\u00fcr-Schritt-Anleitung', pageWidth / 2, y, { align: 'center' })
  y += 12
  const dateStr = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(`Erstellt am ${dateStr}`, pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 40

  // Decorative line
  doc.setDrawColor(93, 107, 93) // sage green
  doc.setLineWidth(1)
  doc.line(margin + 40, y, pageWidth - margin - 40, y)
  y += 20

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  const introLines = doc.splitTextToSize(
    'Diese Anleitung f\u00fchrt Sie durch die Einrichtung Ihres digitalen Lebensordners. Nehmen Sie sich Zeit und folgen Sie den Schritten in Ihrem eigenen Tempo.',
    contentWidth - 20
  )
  doc.text(introLines, margin + 10, y)
  addFooter(1)

  // === PAGE 1: Willkommen ===
  doc.addPage()
  y = 30
  y = addHeading('Willkommen bei Lebensordner', y)
  y += 10
  y = addBody(
    'Der Lebensordner ist Ihr digitaler Ordner f\u00fcr alle wichtigen Dokumente und Informationen. Hier bewahren Sie sicher auf:',
    y,
    14
  )
  y += 6
  y = addBullet('Pers\u00f6nliche Ausweisdokumente', y, '\u2713')
  y = addBullet('Versicherungsunterlagen', y, '\u2713')
  y = addBullet('Medizinische Informationen', y, '\u2713')
  y = addBullet('Notfallkontakte f\u00fcr Ihre Angeh\u00f6rigen', y, '\u2713')
  y = addBullet('Vollmachten und Verf\u00fcgungen', y, '\u2713')
  y += 10
  y = addBody(
    'Alle Ihre Daten werden sicher verschl\u00fcsselt gespeichert. Nur Sie und die von Ihnen gew\u00e4hlten Vertrauenspersonen haben Zugriff.',
    y,
    14
  )
  y += 16

  // Important note box
  doc.setFillColor(255, 249, 235)
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('\u26a0\ufe0f  Wichtiger Hinweis:', margin + 8, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  const noteLines = doc.splitTextToSize(
    'Alle Angaben sind freiwillig. Sie k\u00f6nnen jederzeit Informationen erg\u00e4nzen oder \u00e4ndern.',
    contentWidth - 20
  )
  doc.text(noteLines, margin + 8, y + 20)
  addFooter(2)

  // === PAGE 2: Schritt 1 - Profil ===
  doc.addPage()
  y = 30
  y = addHeading('Schritt 1: Profil ausf\u00fcllen', y)
  y += 8
  y = addBody(
    'Beginnen Sie mit Ihren grundlegenden pers\u00f6nlichen Daten. Diese helfen im Notfall bei der Identifikation.',
    y,
    14
  )
  y += 10
  y = addBody('Folgende Felder stehen zur Verf\u00fcgung:', y, 13)
  y += 4
  y = addBullet('Vollst\u00e4ndiger Name (wie im Ausweis)', y, '1.')
  y = addGrayBox('Beispiel: Max Mustermann', y)
  y = addBullet('Telefonnummer', y, '2.')
  y = addGrayBox('Beispiel: +49 30 12345678', y)
  y = addBullet('Geburtsdatum', y, '3.')
  y = addGrayBox('Beispiel: 15.03.1950', y)
  y = addBullet('Adresse', y, '4.')
  y = addGrayBox('Beispiel: Hauptstra\u00dfe 45, 10115 Berlin', y)
  y += 12
  y = addBody(
    'Tipp: Sie k\u00f6nnen zun\u00e4chst nur Ihren Namen eingeben und die anderen Felder sp\u00e4ter erg\u00e4nzen.',
    y,
    12
  )
  addFooter(3)

  // === PAGE 3: Schritt 2 - Notfallkontakt ===
  doc.addPage()
  y = 30
  y = addHeading('Schritt 2: Notfallkontakt', y)
  y += 8
  y = addBody(
    'Legen Sie fest, wer im Notfall als erstes kontaktiert werden soll. Dies ist eine der wichtigsten Informationen in Ihrem Lebensordner.',
    y,
    14
  )
  y += 10
  y = addBody('Ben\u00f6tigte Informationen:', y, 13)
  y += 4
  y = addBullet('Name der Kontaktperson', y, '1.')
  y = addGrayBox('Beispiel: Anna M\u00fcller', y)
  y = addBullet('Telefonnummer', y, '2.')
  y = addGrayBox('Beispiel: +49 176 98765432', y)
  y = addBullet('Beziehung zu Ihnen', y, '3.')
  y = addGrayBox('Beispiel: Tochter, Ehepartner, Nachbar', y)
  y += 14

  doc.setFillColor(240, 253, 244) // light green
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Warum ist das wichtig?', margin + 8, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  const whyLines = doc.splitTextToSize(
    'Im Notfall k\u00f6nnen Rettungskr\u00e4fte oder \u00c4rzte schnell Ihre Angeh\u00f6rigen informieren. Sp\u00e4ter k\u00f6nnen Sie weitere Kontakte hinzuf\u00fcgen.',
    contentWidth - 20
  )
  doc.text(whyLines, margin + 8, y + 20)
  addFooter(4)

  // === PAGE 4: Schritt 3 - Dokumente ===
  doc.addPage()
  y = 30
  y = addHeading('Schritt 3: Dokumente hochladen', y)
  y += 8
  y = addBody(
    'Nach der Einrichtung k\u00f6nnen Sie Ihre wichtigen Dokumente in verschiedene Kategorien hochladen:',
    y,
    14
  )
  y += 10

  const categories = [
    { name: 'Identit\u00e4t & Ausweise', examples: 'Personalausweis, Reisepass' },
    { name: 'Finanzen', examples: 'Kontoausz\u00fcge, Steuerbescheide' },
    { name: 'Versicherungen', examples: 'Krankenversicherung, Haftpflicht' },
    { name: 'Gesundheit', examples: 'Impfpass, Arztbriefe' },
    { name: 'Immobilien & Wohnen', examples: 'Mietvertrag, Grundbuchauszug' },
    { name: 'Vorsorge', examples: 'Patientenverf\u00fcgung, Testament' },
  ]

  categories.forEach((cat) => {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`\u2022  ${cat.name}`, margin + 5, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(120, 120, 120)
    doc.text(`    z.B. ${cat.examples}`, margin + 5, y + 6)
    doc.setTextColor(0, 0, 0)
    y += 16
  })

  y += 8
  y = addBody(
    'Tipp: Beginnen Sie mit den wichtigsten Dokumenten. Sie k\u00f6nnen Dokumente fotografieren oder als PDF hochladen.',
    y,
    12
  )
  addFooter(5)

  // === PAGE 5: Checkliste ===
  doc.addPage()
  y = 30
  y = addHeading('Checkliste', y)
  y += 10
  y = addBody('Haken Sie ab, was Sie bereits erledigt haben:', y, 14)
  y += 10

  const checklistItems = [
    'Profil mit Name und Geburtsdatum ausgef\u00fcllt',
    'Notfallkontakt hinzugef\u00fcgt',
    'Erste Dokumente hochgeladen (z.B. Personalausweis)',
    'Vertrauensperson eingeladen',
    'Medizinische Informationen eingetragen',
    'Erinnerungen f\u00fcr ablaufende Dokumente gesetzt',
    'Patientenverf\u00fcgung / Vollmachten hinterlegt',
    'Familienmitglieder informiert',
  ]

  checklistItems.forEach((item) => {
    // Draw checkbox
    doc.setDrawColor(93, 107, 93)
    doc.setLineWidth(0.5)
    doc.rect(margin + 2, y - 5, 7, 7)
    // Draw text
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(item, margin + 16, y + 1)
    y += 16
  })

  y += 16
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text('Eigene Notizen:', margin, y)
  y += 8
  // Draw lines for notes
  for (let i = 0; i < 5; i++) {
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 12
  }
  addFooter(6)

  return doc
}

interface PrintGuideButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'onboarding'
  className?: string
  onPrint?: () => void
}

export function PrintGuideButton({
  variant = 'outline',
  size = 'onboarding',
  className = '',
  onPrint,
}: PrintGuideButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handlePrint = async () => {
    setIsGenerating(true)
    try {
      const doc = await generateOnboardingGuidePDF()
      doc.save(`lebensordner-anleitung-${new Date().toISOString().split('T')[0]}.pdf`)
      onPrint?.()
    } catch (error) {
      console.error('PDF generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      disabled={isGenerating}
      className={className}
    >
      {isGenerating ? (
        <Loader2 className="mr-2 w-5 h-5 animate-spin" />
      ) : (
        <Printer className="mr-2 w-5 h-5" />
      )}
      {isGenerating ? 'Wird erstellt...' : 'Anleitung drucken'}
    </Button>
  )
}
