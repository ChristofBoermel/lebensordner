'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronUp, Search, FileText, Users, Shield, Bell, Download, CreditCard } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const faqItems: FAQItem[] = [
  // Allgemein
  {
    category: 'Allgemein',
    question: 'Was ist Lebensordner Digital?',
    answer: 'Lebensordner Digital ist eine sichere Online-Plattform zur Verwaltung Ihrer wichtigsten Lebensdokumente. Sie können Dokumente hochladen, Notfallinformationen hinterlegen und Vertrauenspersonen bestimmen, die im Ernstfall Zugriff erhalten.'
  },
  {
    category: 'Allgemein',
    question: 'Für wen ist Lebensordner geeignet?',
    answer: 'Lebensordner ist für jeden geeignet, der seine wichtigen Dokumente sicher aufbewahren und für den Notfall vorsorgen möchte. Besonders wertvoll ist der Dienst für Familien, Senioren und alle, die sicherstellen möchten, dass ihre Angehörigen im Ernstfall alle wichtigen Informationen haben.'
  },
  {
    category: 'Allgemein',
    question: 'Welche Dokumente sollte ich hochladen?',
    answer: 'Wir empfehlen das Hochladen von: Ausweisdokumenten, Versicherungspolicen, Miet- und Kaufverträgen, Testament und Vorsorgevollmacht, Patientenverfügung, Bankunterlagen, Arbeitsverträgen und anderen wichtigen Dokumenten, die im Notfall schnell auffindbar sein sollten.'
  },
  // Sicherheit
  {
    category: 'Sicherheit',
    question: 'Wie sicher sind meine Daten?',
    answer: 'Ihre Sicherheit hat für uns höchste Priorität. Alle Daten werden mit modernster Verschlüsselung (TLS/SSL) übertragen und auf Servern in Deutschland gespeichert. Wir befolgen streng die DSGVO und verkaufen niemals Ihre Daten.'
  },
  {
    category: 'Sicherheit',
    question: 'Wer hat Zugriff auf meine Dokumente?',
    answer: 'Nur Sie und die von Ihnen benannten Vertrauenspersonen haben Zugriff auf Ihre Dokumente. Unsere Mitarbeiter haben keinen Zugriff auf Ihre verschlüsselten Dateien.'
  },
  {
    category: 'Sicherheit',
    question: 'Was ist Zwei-Faktor-Authentifizierung?',
    answer: 'Die Zwei-Faktor-Authentifizierung (2FA) bietet zusätzliche Sicherheit. Neben Ihrem Passwort benötigen Sie einen Code aus einer Authenticator-App, um sich anzumelden. Diese Funktion ist für Premium-Nutzer verfügbar.'
  },
  // Vertrauenspersonen
  {
    category: 'Vertrauenspersonen',
    question: 'Was sind Vertrauenspersonen?',
    answer: 'Vertrauenspersonen sind Menschen, denen Sie im Notfall Zugriff auf Ihre Dokumente gewähren möchten. Dies können Familienmitglieder, enge Freunde oder Ihr Anwalt sein.'
  },
  {
    category: 'Vertrauenspersonen',
    question: 'Wie füge ich eine Vertrauensperson hinzu?',
    answer: 'Gehen Sie zu "Zugriff & Familie" und klicken Sie auf "Person hinzufügen". Geben Sie die E-Mail-Adresse der Person ein und wählen Sie die Zugriffsebene. Die Person erhält eine Einladung per E-Mail.'
  },
  {
    category: 'Vertrauenspersonen',
    question: 'Können Vertrauenspersonen meine Dokumente ändern?',
    answer: 'Nein, Vertrauenspersonen haben nur Lesezugriff auf Ihre Dokumente. Nur Sie können Dokumente hochladen, bearbeiten oder löschen.'
  },
  // Abonnement
  {
    category: 'Abonnement',
    question: 'Welche Abonnements gibt es?',
    answer: 'Wir bieten drei Stufen: Kostenlos (10 Dokumente, 100 MB), Basis (50 Dokumente, 500 MB, 4,90€/Monat) und Premium (unbegrenzt, 10 GB, 11,90€/Monat). Premium enthält zusätzlich 2FA und Prioritäts-Support.'
  },
  {
    category: 'Abonnement',
    question: 'Kann ich mein Abonnement jederzeit kündigen?',
    answer: 'Ja, Sie können Ihr Abonnement jederzeit kündigen. Sie behalten den Zugriff bis zum Ende der bezahlten Periode. Bei der kostenlosen Version werden Ihre Dokumente auf das Limit reduziert.'
  },
  {
    category: 'Abonnement',
    question: 'Wie kann ich bezahlen?',
    answer: 'Wir akzeptieren alle gängigen Kreditkarten, SEPA-Lastschrift und PayPal. Die Zahlung wird sicher über Stripe abgewickelt.'
  },
  // Erinnerungen
  {
    category: 'Erinnerungen',
    question: 'Wie funktionieren Erinnerungen?',
    answer: 'Sie können für Dokumente mit Ablaufdatum (z.B. Ausweis, Versicherung) automatische Erinnerungen einrichten. Wir benachrichtigen Sie per E-Mail, wenn ein Dokument bald abläuft.'
  },
  {
    category: 'Erinnerungen',
    question: 'Kann ich eigene Erinnerungen erstellen?',
    answer: 'Ja, Sie können eigene Erinnerungen für beliebige Termine erstellen. Gehen Sie zu "Erinnerungen" und klicken Sie auf "Neue Erinnerung".'
  },
  // Export
  {
    category: 'Export',
    question: 'Kann ich meine Dokumente exportieren?',
    answer: 'Ja, Sie können alle Ihre Dokumente als ZIP-Datei herunterladen. Zusätzlich können Sie eine Übersicht Ihrer Dokumente als PDF drucken.'
  },
  {
    category: 'Export',
    question: 'Was ist der Notfall-QR-Code?',
    answer: 'Der Notfall-QR-Code enthält Ihre wichtigsten Notfallinformationen (Kontakte, medizinische Daten). Sie können ihn ausdrucken und z.B. auf Ihre Krankenkassenkarte kleben.'
  },
]

const categories = [
  { name: 'Allgemein', icon: FileText },
  { name: 'Sicherheit', icon: Shield },
  { name: 'Vertrauenspersonen', icon: Users },
  { name: 'Abonnement', icon: CreditCard },
  { name: 'Erinnerungen', icon: Bell },
  { name: 'Export', icon: Download },
]

export default function HilfePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems)
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index)
    } else {
      newOpenItems.add(index)
    }
    setOpenItems(newOpenItems)
  }

  const filteredItems = faqItems.filter(item => {
    const matchesSearch = !searchQuery ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-cream-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-sage-600 hover:text-sage-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Startseite
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-warmgray-900 mb-2">
            Hilfe & FAQ
          </h1>
          <p className="text-warmgray-600">
            Finden Sie Antworten auf häufig gestellte Fragen
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
          <Input
            placeholder="Suchen Sie nach einem Thema..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory
                ? 'bg-sage-600 text-white'
                : 'bg-warmgray-100 text-warmgray-700 hover:bg-warmgray-200'
            }`}
          >
            Alle
          </button>
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedCategory === category.name
                    ? 'bg-sage-600 text-white'
                    : 'bg-warmgray-100 text-warmgray-700 hover:bg-warmgray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </button>
            )
          })}
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-warmgray-500">
                Keine Ergebnisse gefunden. Versuchen Sie einen anderen Suchbegriff.
              </CardContent>
            </Card>
          ) : (
            filteredItems.map((item, index) => (
              <Card key={index} className="overflow-hidden">
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-warmgray-50 transition-colors"
                >
                  <div className="flex-1">
                    <span className="text-xs font-medium text-sage-600 mb-1 block">
                      {item.category}
                    </span>
                    <span className="font-medium text-warmgray-900">
                      {item.question}
                    </span>
                  </div>
                  {openItems.has(index) ? (
                    <ChevronUp className="w-5 h-5 text-warmgray-400 flex-shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-warmgray-400 flex-shrink-0 ml-4" />
                  )}
                </button>
                {openItems.has(index) && (
                  <CardContent className="pt-0 pb-4 px-6 border-t border-warmgray-100">
                    <p className="text-warmgray-700 pt-4">
                      {item.answer}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Contact CTA */}
        <Card className="mt-8">
          <CardContent className="py-8 text-center">
            <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
              Noch Fragen?
            </h3>
            <p className="text-warmgray-600 mb-4">
              Wir helfen Ihnen gerne weiter!
            </p>
            <Link
              href="/kontakt"
              className="inline-flex items-center px-6 py-3 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors font-medium"
            >
              Kontakt aufnehmen
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
