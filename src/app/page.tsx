import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Shield, 
  Heart, 
  Users, 
  FileText, 
  Lock, 
  CheckCircle2,
  ArrowRight,
  Leaf
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="border-b border-cream-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="section-container">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-warmgray-900">Lebensordner</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#funktionen" className="text-warmgray-600 hover:text-sage-600 transition-colors">
                Funktionen
              </Link>
              <Link href="#sicherheit" className="text-warmgray-600 hover:text-sage-600 transition-colors">
                Sicherheit
              </Link>
              <Link href="#preise" className="text-warmgray-600 hover:text-sage-600 transition-colors">
                Preise
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <Link href="/anmelden">
                <Button variant="ghost">Anmelden</Button>
              </Link>
              <Link href="/registrieren">
                <Button>Kostenlos testen</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-28">
        <div className="section-container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-warmgray-900 mb-6 text-balance animate-fade-in">
              Wüsste Ihre Familie, was zu tun ist, wenn heute etwas passiert?
            </h1>
            <p className="text-xl text-warmgray-600 mb-10 leading-relaxed animate-fade-in animation-delay-100">
              Ein sicherer Ort für Ihre wichtigen Unterlagen, klare Anweisungen und die 
              Beruhigung, dass alles geregelt ist.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in animation-delay-200">
              <Link href="/registrieren">
                <Button size="lg" className="w-full sm:w-auto">
                  30 Tage kostenlos testen
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#funktionen">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Mehr erfahren
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 border-y border-cream-200 bg-white">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center justify-center gap-3">
              <Lock className="w-6 h-6 text-sage-600" />
              <span className="text-warmgray-700">Ende-zu-Ende verschlüsselt</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Shield className="w-6 h-6 text-sage-600" />
              <span className="text-warmgray-700">Server in Deutschland</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-sage-600" />
              <span className="text-warmgray-700">Kein Datenverkauf, keine Werbung</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funktionen" className="py-20">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-semibold text-warmgray-900 mb-4">
              Alles Wichtige an einem Ort
            </h2>
            <p className="text-lg text-warmgray-600 max-w-2xl mx-auto">
              Lebensordner Digital ist wie ein gut sortierter Aktenordner – nur sicherer, 
              übersichtlicher und immer verfügbar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <div className="card-elevated p-8">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mb-5">
                <FileText className="w-6 h-6 text-sage-600" />
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Dokumente organisieren
              </h3>
              <p className="text-warmgray-600">
                Laden Sie wichtige Unterlagen hoch – von Ausweisen über Verträge 
                bis hin zu Versicherungspolicen. Alles klar strukturiert und schnell auffindbar.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="card-elevated p-8">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mb-5">
                <Heart className="w-6 h-6 text-sage-600" />
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Notfall-Informationen
              </h3>
              <p className="text-warmgray-600">
                Hinterlegen Sie wichtige Kontakte, medizinische Informationen und 
                Handlungsanweisungen für den Ernstfall.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="card-elevated p-8">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-sage-600" />
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-3">
                Vertrauenspersonen
              </h3>
              <p className="text-warmgray-600">
                Bestimmen Sie, wer im Notfall Zugriff erhält. Sie behalten die 
                volle Kontrolle über Ihre Daten.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white border-y border-cream-200">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-semibold text-warmgray-900 mb-4">
              So einfach funktioniert es
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-sage-600 text-white flex items-center justify-center text-xl font-semibold mx-auto mb-5">
                1
              </div>
              <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                Registrieren
              </h3>
              <p className="text-warmgray-600">
                Erstellen Sie Ihr persönliches Konto in wenigen Minuten.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-sage-600 text-white flex items-center justify-center text-xl font-semibold mx-auto mb-5">
                2
              </div>
              <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                Organisieren
              </h3>
              <p className="text-warmgray-600">
                Laden Sie Dokumente hoch und füllen Sie Schritt für Schritt Ihre Informationen aus.
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-sage-600 text-white flex items-center justify-center text-xl font-semibold mx-auto mb-5">
                3
              </div>
              <h3 className="text-lg font-semibold text-warmgray-900 mb-2">
                Absichern
              </h3>
              <p className="text-warmgray-600">
                Fügen Sie Vertrauenspersonen hinzu und genießen Sie die Gewissheit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="sicherheit" className="py-20">
        <div className="section-container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-serif font-semibold text-warmgray-900 mb-4">
                Ihre Sicherheit ist uns wichtig
              </h2>
              <p className="text-lg text-warmgray-600">
                Wir wissen, wie sensibel Ihre Daten sind. Deshalb haben wir 
                Lebensordner von Grund auf sicher konzipiert.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-sage-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-warmgray-900 mb-1">
                    Ende-zu-Ende Verschlüsselung
                  </h3>
                  <p className="text-warmgray-600">
                    Alle Ihre Dokumente werden verschlüsselt übertragen und gespeichert. 
                    Nur Sie und Ihre autorisierten Vertrauenspersonen haben Zugriff.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-sage-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-warmgray-900 mb-1">
                    Server in Deutschland
                  </h3>
                  <p className="text-warmgray-600">
                    Ihre Daten werden ausschließlich auf Servern in Deutschland gespeichert 
                    und unterliegen strengen deutschen Datenschutzgesetzen.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-sage-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-warmgray-900 mb-1">
                    Volle Datenhoheit
                  </h3>
                  <p className="text-warmgray-600">
                    Keine Werbung, kein Datenverkauf, keine versteckten Zwecke. 
                    Sie behalten jederzeit die volle Kontrolle über Ihre Informationen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="preise" className="py-20 bg-white border-y border-cream-200">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-semibold text-warmgray-900 mb-4">
              Einfache, transparente Preise
            </h2>
            <p className="text-lg text-warmgray-600">
              30 Tage kostenlos testen – keine Kreditkarte erforderlich.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="card-elevated p-6 text-center">
              <h3 className="text-xl font-semibold text-warmgray-900 mb-1">
                Kostenlos
              </h3>
              <p className="text-warmgray-600 text-sm mb-4">
                Für den Einstieg
              </p>

              <div className="mb-6">
                <span className="text-3xl font-semibold text-warmgray-900">0 €</span>
                <span className="text-warmgray-600"> / Monat</span>
              </div>

              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Bis zu 10 Dokumente</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">100 MB Speicherplatz</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">5 Unterordner</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Basis-Dashboard</span>
                </li>
              </ul>

              <Link href="/registrieren">
                <Button variant="outline" className="w-full">
                  Kostenlos starten
                </Button>
              </Link>
            </div>

            {/* Basic Tier */}
            <div className="card-elevated p-6 text-center">
              <h3 className="text-xl font-semibold text-warmgray-900 mb-1">
                Basis
              </h3>
              <p className="text-warmgray-600 text-sm mb-4">
                Für Einzelpersonen
              </p>

              <div className="mb-6">
                <span className="text-3xl font-semibold text-warmgray-900">4,90 €</span>
                <span className="text-warmgray-600"> / Monat</span>
              </div>

              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Bis zu 50 Dokumente</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">500 MB Speicherplatz</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">3 Vertrauenspersonen</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">E-Mail-Erinnerungen</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Dokument-Ablaufdatum</span>
                </li>
              </ul>

              <Link href="/registrieren">
                <Button variant="outline" className="w-full">
                  30 Tage kostenlos testen
                </Button>
              </Link>
            </div>

            {/* Premium Tier */}
            <div className="card-elevated p-6 text-center border-2 border-sage-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sage-600 text-white text-xs font-medium rounded-full">
                Beliebt
              </div>
              <h3 className="text-xl font-semibold text-warmgray-900 mb-1">
                Premium
              </h3>
              <p className="text-warmgray-600 text-sm mb-4">
                Voller Schutz
              </p>

              <div className="mb-6">
                <span className="text-3xl font-semibold text-warmgray-900">11,90 €</span>
                <span className="text-warmgray-600"> / Monat</span>
              </div>

              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Unbegrenzte Dokumente</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">10 GB Speicherplatz</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">10 Vertrauenspersonen</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Zwei-Faktor-Auth</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span className="text-warmgray-700">Prioritäts-Support</span>
                </li>
              </ul>

              <Link href="/registrieren">
                <Button size="lg" className="w-full">
                  30 Tage kostenlos testen
                </Button>
              </Link>
            </div>
          </div>
          <p className="text-center text-sm text-warmgray-500 mt-6">
            Jederzeit kündbar. Keine versteckten Kosten.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="section-container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-serif font-semibold text-warmgray-900 mb-4">
              Schaffen Sie Klarheit für sich und Ihre Familie
            </h2>
            <p className="text-lg text-warmgray-600 mb-8">
              Beginnen Sie heute damit, Ihre wichtigen Unterlagen zu organisieren. 
              Für Ihre eigene Sicherheit und die Ihrer Liebsten.
            </p>
            <Link href="/registrieren">
              <Button size="lg">
                Jetzt kostenlos starten
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
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
                <li><Link href="#funktionen" className="hover:text-white transition-colors">Funktionen</Link></li>
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
