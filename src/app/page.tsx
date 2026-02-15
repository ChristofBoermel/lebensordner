import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FAQAccordion } from '@/components/landing/faq-accordion'
import { LandingNav } from '@/components/layout/landing-nav'
import {
  Shield,
  Users,
  FileText,
  Lock,
  CheckCircle2,
  ArrowRight,
  Leaf,
  FolderOpen,
  HelpCircle,
  FolderCheck,
  Server,
  KeyRound,
  Trash2,
  Quote
} from 'lucide-react'

const faqItems = [
  {
    question: 'Brauche ich besondere Computer-Kenntnisse?',
    answer: 'Nein. Wenn Sie E-Mails schreiben können, können Sie auch Lebensordner nutzen. Wir führen Sie Schritt für Schritt durch alles.'
  },
  {
    question: 'Wie sicher sind meine Daten wirklich?',
    answer: 'Ihre Dokumente werden mit der gleichen Technologie geschützt wie beim Online-Banking. Sie werden verschlüsselt in deutschen Rechenzentren gespeichert.'
  },
  {
    question: 'Was passiert, wenn ich nicht mehr kann?',
    answer: 'Ihre Vertrauenspersonen können dann auf die Dokumente zugreifen, die Sie für sie freigegeben haben. Sie bestimmen selbst, wer was sehen darf.'
  },
  {
    question: 'Kann ich das erst einmal ausprobieren?',
    answer: 'Ja, Sie können kostenlos starten. Wenn Sie mehr Funktionen möchten, können Sie 30 Tage kostenlos testen.'
  },
  {
    question: 'Wie kündige ich, wenn es mir nicht gefällt?',
    answer: 'Sie können jederzeit mit einem Klick kündigen. Ihre Daten werden dann vollständig gelöscht.'
  },
  {
    question: 'Kann mir jemand helfen, wenn ich nicht weiterkomme?',
    answer: 'Natürlich. Wir haben eine ausführliche Hilfe und beantworten gerne Ihre Fragen per E-Mail.'
  }
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <LandingNav />

      {/* Hero Section */}
      <section className="py-20 md:py-28">
        <div className="section-container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-warmgray-900 mb-6 text-balance leading-tight">
              Ihre wichtigen Dokumente. Sicher an einem Ort.
            </h1>
            <p className="text-xl md:text-2xl text-warmgray-600 mb-10 leading-relaxed">
              Lebensordner hilft Ihnen, alle wichtigen Unterlagen digital zu organisieren –
              für sich selbst und Ihre Angehörigen.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/registrieren">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
                  Jetzt kostenlos starten
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#so-funktionierts">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
                  Wie funktioniert das?
                </Button>
              </Link>
            </div>

            {/* Trust Element */}
            <div className="flex items-center justify-center gap-2 text-warmgray-600">
              <Server className="w-5 h-5 text-sage-600" />
              <span>Ihre Daten bleiben in Deutschland</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem-Solution Section */}
      <section className="py-16 md:py-20 bg-white border-y border-cream-200">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-4">
              Kennen Sie das?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Problem Card 1 */}
            <div className="card-elevated p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-cream-100 flex items-center justify-center mx-auto mb-5">
                <FolderOpen className="w-8 h-8 text-warmgray-500" />
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Unterlagen überall verstreut
              </h3>
              <p className="text-warmgray-600 text-lg leading-relaxed">
                Versicherungen im Schrank, Testament beim Notar, Vollmachten in der Schublade.
              </p>
            </div>

            {/* Problem Card 2 */}
            <div className="card-elevated p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-cream-100 flex items-center justify-center mx-auto mb-5">
                <HelpCircle className="w-8 h-8 text-warmgray-500" />
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Im Notfall fehlt der Überblick
              </h3>
              <p className="text-warmgray-600 text-lg leading-relaxed">
                Ihre Familie weiß nicht, wo welche Dokumente liegen und was wichtig ist.
              </p>
            </div>

            {/* Solution Card */}
            <div className="card-elevated p-8 text-center border-2 border-sage-200 bg-sage-50/50">
              <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-5">
                <FolderCheck className="w-8 h-8 text-sage-600" />
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Alles geordnet und zugänglich
              </h3>
              <p className="text-warmgray-600 text-lg leading-relaxed">
                Mit Lebensordner haben Sie und Ihre Vertrauenspersonen jederzeit Zugriff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section id="so-funktionierts" className="py-16 md:py-20">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-4">
              In 3 Schritten zu mehr Ordnung
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-sage-600 text-white flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Dokumente hochladen
              </h3>
              <p className="text-warmgray-600 text-lg leading-relaxed">
                Scannen oder fotografieren Sie wichtige Unterlagen mit Ihrem Handy oder Computer.
                Wir helfen Ihnen dabei.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-sage-600 text-white flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Übersichtlich sortieren
              </h3>
              <p className="text-warmgray-600 text-lg leading-relaxed">
                Ordnen Sie Ihre Dokumente in einfache Kategorien: Versicherungen, Vorsorge,
                Finanzen, Gesundheit.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-sage-600 text-white flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Vertrauenspersonen einladen
              </h3>
              <p className="text-warmgray-600 text-lg leading-relaxed">
                Bestimmen Sie, wer im Notfall Zugriff haben soll – Ihre Kinder, Partner
                oder andere Vertraute.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust/Security Section */}
      <section id="sicherheit" className="py-16 md:py-20 bg-white border-y border-cream-200">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-4">
              Ihre Sicherheit ist uns wichtig
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Trust Element 1 */}
            <div className="flex gap-5 p-6 card-elevated">
              <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                <Server className="w-7 h-7 text-sage-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                  Deutsche Server
                </h3>
                <p className="text-warmgray-600 text-lg leading-relaxed">
                  Alle Daten werden ausschließlich in Deutschland gespeichert.
                </p>
              </div>
            </div>

            {/* Trust Element 2 */}
            <div className="flex gap-5 p-6 card-elevated">
              <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                <Lock className="w-7 h-7 text-sage-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                  Bank-Standard Verschlüsselung
                </h3>
                <p className="text-warmgray-600 text-lg leading-relaxed">
                  Ihre Dokumente sind so sicher wie bei Ihrem Online-Banking.
                </p>
              </div>
            </div>

            {/* Trust Element 3 */}
            <div className="flex gap-5 p-6 card-elevated">
              <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-7 h-7 text-sage-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                  Nur Sie haben Zugriff
                </h3>
                <p className="text-warmgray-600 text-lg leading-relaxed">
                  Niemand außer Ihnen kann Ihre Unterlagen einsehen – auch wir nicht.
                </p>
              </div>
            </div>

            {/* Trust Element 4 */}
            <div className="flex gap-5 p-6 card-elevated">
              <div className="w-14 h-14 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-7 h-7 text-sage-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                  Jederzeit kündbar
                </h3>
                <p className="text-warmgray-600 text-lg leading-relaxed">
                  Sie können Ihr Konto und alle Daten jederzeit vollständig löschen.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who is it for Section */}
      <section className="py-16 md:py-20">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-4">
              Lebensordner ist für Sie gemacht
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Column 1 */}
            <div className="card-elevated p-8">
              <h3 className="text-2xl font-semibold text-warmgray-900 mb-6">
                Für mich selbst
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Sie möchten den Überblick behalten</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Sie wollen vorbereitet sein</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Sie schätzen Ordnung und Sicherheit</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Sie möchten Ihre Familie entlasten</span>
                </li>
              </ul>
            </div>

            {/* Column 2 */}
            <div className="card-elevated p-8">
              <h3 className="text-2xl font-semibold text-warmgray-900 mb-6">
                Für meine Angehörigen
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Ihre Kinder machen sich Sorgen</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Sie möchten im Notfall erreichbar sein</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Sie wollen wissen, was wichtig ist</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-sage-600 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-warmgray-700">Sie möchten helfen können</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="preise" className="py-16 md:py-20 bg-white border-y border-cream-200">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-4">
              Transparent und fair
            </h2>
            <p className="text-xl text-warmgray-600">
              Starten Sie kostenlos. Erweitern Sie, wenn Sie mehr brauchen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="card-elevated p-8 text-center flex flex-col">
              <h3 className="text-2xl font-semibold text-warmgray-900 mb-2">
                Kostenlos
              </h3>
              <p className="text-warmgray-600 mb-6">
                Zum Kennenlernen
              </p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-warmgray-900">0 €</span>
                <span className="text-warmgray-600 text-lg"> / Monat</span>
              </div>

              <ul className="text-left space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">10 Dokumente</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">1 Vertrauensperson</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Alle Basis-Funktionen</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Unbegrenzt lange nutzbar</span>
                </li>
              </ul>

              <Link href="/registrieren" className="mt-auto">
                <Button variant="outline" size="lg" className="w-full text-lg">
                  Kostenlos starten
                </Button>
              </Link>
            </div>

            {/* Basic Tier */}
            <div className="card-elevated p-8 text-center border-2 border-sage-500 relative flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-sage-600 text-white text-sm font-medium rounded-full">
                Empfohlen
              </div>
              <h3 className="text-2xl font-semibold text-warmgray-900 mb-2">
                Basis
              </h3>
              <p className="text-warmgray-600 mb-6">
                Für den Alltag
              </p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-warmgray-900">4,90 €</span>
                <span className="text-warmgray-600 text-lg"> / Monat</span>
              </div>
              <p className="text-sage-600 font-medium mb-6">
                oder 49 € / Jahr (spare 2 Monate!)
              </p>

              <ul className="text-left space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">50 Dokumente</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">3 Vertrauenspersonen</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Ordnerstruktur</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">E-Mail-Erinnerungen</span>
                </li>
              </ul>

              <Link href="/registrieren" className="mt-auto">
                <Button size="lg" className="w-full text-lg">
                  30 Tage kostenlos testen
                </Button>
              </Link>
            </div>

            {/* Premium Tier */}
            <div className="card-elevated p-8 text-center flex flex-col">
              <h3 className="text-2xl font-semibold text-warmgray-900 mb-2">
                Premium
              </h3>
              <p className="text-warmgray-600 mb-6">
                Rundum sorglos
              </p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-warmgray-900">11,90 €</span>
                <span className="text-warmgray-600 text-lg"> / Monat</span>
              </div>
              <p className="text-sage-600 font-medium mb-6">
                oder 119 € / Jahr
              </p>

              <ul className="text-left space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Unbegrenzt Dokumente</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Unbegrenzt Vertrauenspersonen</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Prioritäts-Support</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Frühzugang zu neuen Features</span>
                </li>
              </ul>

              <Link href="/registrieren" className="mt-auto">
                <Button variant="outline" size="lg" className="w-full text-lg">
                  30 Tage kostenlos testen
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-center text-warmgray-600 mt-8 text-lg">
            Keine versteckten Kosten. Jederzeit kündbar.
          </p>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-20">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-4">
              Das sagen unsere Nutzer
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Testimonial 1 */}
            <div className="card-elevated p-8">
              <Quote className="w-10 h-10 text-sage-300 mb-4" />
              <p className="text-warmgray-700 text-lg leading-relaxed mb-6">
                &ldquo;Endlich habe ich alle wichtigen Unterlagen beisammen. Meine Tochter kann im Notfall
                sofort darauf zugreifen. Das gibt mir ein gutes Gefühl.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
                  <span className="text-sage-700 font-semibold">MS</span>
                </div>
                <div>
                  <p className="font-semibold text-warmgray-900">Margarete S.</p>
                  <p className="text-warmgray-500">67 Jahre</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="card-elevated p-8">
              <Quote className="w-10 h-10 text-sage-300 mb-4" />
              <p className="text-warmgray-700 text-lg leading-relaxed mb-6">
                &ldquo;Ich war skeptisch wegen der Technik. Aber es ist wirklich einfach. Sogar ich
                bekomme das hin – und ich bin kein Computer-Experte.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
                  <span className="text-sage-700 font-semibold">KM</span>
                </div>
                <div>
                  <p className="font-semibold text-warmgray-900">Klaus M.</p>
                  <p className="text-warmgray-500">72 Jahre</p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="card-elevated p-8">
              <Quote className="w-10 h-10 text-sage-300 mb-4" />
              <p className="text-warmgray-700 text-lg leading-relaxed mb-6">
                &ldquo;Für meine Mutter eingerichtet. Sie fühlt sich jetzt sicherer, und ich weiß,
                wo alles ist. Perfekt für beide Seiten.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
                  <span className="text-sage-700 font-semibold">AK</span>
                </div>
                <div>
                  <p className="font-semibold text-warmgray-900">Andrea K.</p>
                  <p className="text-warmgray-500">45 Jahre (Tochter)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-20 bg-white border-y border-cream-200">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-4">
              Häufige Fragen
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <FAQAccordion items={faqItems} />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 md:py-28">
        <div className="section-container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-warmgray-900 mb-6">
              Beginnen Sie heute
            </h2>
            <p className="text-xl text-warmgray-600 mb-10 leading-relaxed">
              Bringen Sie Ordnung in Ihre wichtigen Unterlagen. Kostenlos und unverbindlich.
            </p>
            <Link href="/registrieren">
              <Button size="lg" className="text-lg px-10 py-6">
                Jetzt kostenlos registrieren
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-warmgray-500 mt-6">
              Keine Kreditkarte erforderlich. In 2 Minuten startklar.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-warmgray-900 text-warmgray-300">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-sage-600 flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-white">Lebensordner</span>
              </div>
              <p className="text-sm">
                Der sichere digitale Lebensorganisator für Ihre persönlichen Unterlagen.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Produkt</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#so-funktionierts" className="hover:text-white transition-colors">So funktioniert&apos;s</Link></li>
                <li><Link href="#sicherheit" className="hover:text-white transition-colors">Sicherheit</Link></li>
                <li><Link href="#preise" className="hover:text-white transition-colors">Preise</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Rechtliches</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/impressum" className="hover:text-white transition-colors">Impressum</Link></li>
                <li><Link href="/datenschutz" className="hover:text-white transition-colors">Datenschutz</Link></li>
                <li><Link href="/agb" className="hover:text-white transition-colors">AGB</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Kontakt</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/kontakt" className="hover:text-white transition-colors">Kontaktformular</Link></li>
                <li><Link href="/hilfe" className="hover:text-white transition-colors">Hilfe & FAQ</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-warmgray-700 mt-10 pt-8 text-sm text-center">
            <p>© 2026 Lebensordner Digital. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
