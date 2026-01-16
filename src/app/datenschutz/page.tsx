import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Datenschutzerklärung - Lebensordner Digital',
}

export default function DatenschutzPage() {
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
            <CardTitle className="text-2xl font-serif">Datenschutzerklärung</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-warmgray max-w-none">
            <p className="text-warmgray-600 mb-6">
              Stand: Januar 2025
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">1. Verantwortlicher</h2>
            <p className="text-warmgray-700 mb-4">
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br />
              Lebensordner Digital<br />
              [Ihre Adresse]<br />
              E-Mail: datenschutz@lebensordner.org
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">2. Erhebung und Speicherung personenbezogener Daten</h2>
            <p className="text-warmgray-700 mb-4">
              Wir erheben personenbezogene Daten, wenn Sie sich registrieren, unsere Dienste nutzen 
              oder mit uns Kontakt aufnehmen. Dies umfasst:
            </p>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>Name und E-Mail-Adresse bei der Registrierung</li>
              <li>Dokumente und Dateien, die Sie hochladen</li>
              <li>Kontaktdaten Ihrer Vertrauenspersonen</li>
              <li>Zahlungsinformationen bei kostenpflichtigen Abonnements</li>
            </ul>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">3. Zweck der Datenverarbeitung</h2>
            <p className="text-warmgray-700 mb-4">
              Ihre Daten werden ausschließlich verwendet für:
            </p>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>Die Bereitstellung unserer Dienste</li>
              <li>Die Verwaltung Ihres Benutzerkontos</li>
              <li>Die Abwicklung von Zahlungen</li>
              <li>Die Kommunikation mit Ihnen (z.B. Erinnerungen)</li>
            </ul>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">4. Datensicherheit</h2>
            <p className="text-warmgray-700 mb-4">
              Alle Daten werden verschlüsselt übertragen (TLS/SSL) und sicher in der EU gespeichert. 
              Ihre hochgeladenen Dokumente werden mit modernsten Verschlüsselungsmethoden geschützt.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">5. Ihre Rechte</h2>
            <p className="text-warmgray-700 mb-4">
              Sie haben das Recht auf:
            </p>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>Auskunft über Ihre gespeicherten Daten</li>
              <li>Berichtigung unrichtiger Daten</li>
              <li>Löschung Ihrer Daten</li>
              <li>Einschränkung der Verarbeitung</li>
              <li>Datenübertragbarkeit</li>
              <li>Widerruf erteilter Einwilligungen</li>
            </ul>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">6. Cookies</h2>
            <p className="text-warmgray-700 mb-4">
              Wir verwenden nur technisch notwendige Cookies für die Funktionalität der Website 
              sowie optionale Analyse-Cookies (PostHog) zur Verbesserung unserer Dienste, 
              die Sie ablehnen können.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">7. Kontakt</h2>
            <p className="text-warmgray-700 mb-4">
              Bei Fragen zum Datenschutz wenden Sie sich bitte an:<br />
              datenschutz@lebensordner.org
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
