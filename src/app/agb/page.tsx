import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 3600 // Cache for 1 hour (rarely changes)

export const metadata = {
  title: 'Allgemeine Geschäftsbedingungen - Lebensordner Digital',
}

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-cream-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center text-sage-600 hover:text-sage-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Startseite
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-serif">Allgemeine Geschäftsbedingungen</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-warmgray max-w-none">
            <p className="text-warmgray-600 mb-6">
              Stand: Januar 2025
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 1 Geltungsbereich</h2>
            <p className="text-warmgray-700 mb-4">
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform 
              „Lebensordner Digital" (nachfolgend „Dienst"). Mit der Registrierung akzeptieren 
              Sie diese Bedingungen.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 2 Leistungsbeschreibung</h2>
            <p className="text-warmgray-700 mb-4">
              Lebensordner Digital bietet eine Plattform zur digitalen Verwaltung wichtiger 
              Lebensdokumente. Der Dienst umfasst je nach gewähltem Tarif:
            </p>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>Sichere Speicherung von Dokumenten</li>
              <li>Verwaltung von Vertrauenspersonen</li>
              <li>Erinnerungsfunktionen</li>
              <li>Export- und Backup-Funktionen</li>
            </ul>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 3 Registrierung und Benutzerkonto</h2>
            <p className="text-warmgray-700 mb-4">
              Für die Nutzung des Dienstes ist eine Registrierung erforderlich. Sie sind 
              verpflichtet, wahrheitsgemäße Angaben zu machen und Ihre Zugangsdaten geheim zu halten.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 4 Preise und Zahlung</h2>
            <p className="text-warmgray-700 mb-4">
              Die aktuellen Preise sind auf unserer Website einsehbar. Kostenpflichtige 
              Abonnements werden monatlich oder jährlich im Voraus abgerechnet. Die Zahlung 
              erfolgt über sichere Zahlungsanbieter (Stripe).
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 5 Kostenlose Testphase</h2>
            <p className="text-warmgray-700 mb-4">
              Neue Nutzer erhalten eine 30-tägige kostenlose Testphase. Nach Ablauf wird das 
              gewählte Abonnement automatisch kostenpflichtig, sofern nicht vorher gekündigt.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 6 Kündigung</h2>
            <p className="text-warmgray-700 mb-4">
              Sie können Ihr Abonnement jederzeit zum Ende der aktuellen Abrechnungsperiode 
              kündigen. Nach Kündigung bleibt der Zugang bis zum Ende der bezahlten Periode bestehen.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 7 Haftung</h2>
            <p className="text-warmgray-700 mb-4">
              Wir bemühen uns um höchstmögliche Verfügbarkeit und Datensicherheit. Eine Haftung 
              für Datenverluste ist auf Vorsatz und grobe Fahrlässigkeit beschränkt. Wir empfehlen, 
              regelmäßig Backups Ihrer Daten zu erstellen.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 8 Datenschutz</h2>
            <p className="text-warmgray-700 mb-4">
              Die Verarbeitung Ihrer personenbezogenen Daten erfolgt gemäß unserer{' '}
              <Link href="/datenschutz" className="text-sage-600 hover:text-sage-700">
                Datenschutzerklärung
              </Link>.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 9 Änderungen der AGB</h2>
            <p className="text-warmgray-700 mb-4">
              Wir behalten uns vor, diese AGB zu ändern. Über wesentliche Änderungen werden 
              Sie per E-Mail informiert.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">§ 10 Schlussbestimmungen</h2>
            <p className="text-warmgray-700 mb-4">
              Es gilt deutsches Recht. Sollten einzelne Bestimmungen unwirksam sein, bleibt 
              die Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Kontakt</h2>
            <p className="text-warmgray-700 mb-4">
              Bei Fragen zu diesen AGB wenden Sie sich bitte an:<br />
              info@lebensordner.org
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
