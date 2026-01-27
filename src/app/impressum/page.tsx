import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Impressum - Lebensordner Digital',
}

export default function ImpressumPage() {
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
            <CardTitle className="text-2xl font-serif">Impressum</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-warmgray max-w-none">
            <h2 className="text-xl font-semibold text-warmgray-900 mt-4 mb-4">Angaben gemäß § 5 TMG</h2>
            <p className="text-warmgray-700 mb-4">
              Lebensordner Digital<br />
              [Straße und Hausnummer]<br />
              [PLZ] [Stadt]<br />
              Deutschland
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Vertreten durch</h2>
            <p className="text-warmgray-700 mb-4">
              [Geschäftsführer/Inhaber Name]
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Kontakt</h2>
            <p className="text-warmgray-700 mb-4">
              Telefon: [Telefonnummer]<br />
              E-Mail: kontakt@lebensordner.org
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Umsatzsteuer-ID</h2>
            <p className="text-warmgray-700 mb-4">
              Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br />
              [USt-IdNr.]
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Streitschlichtung</h2>
            <p className="text-warmgray-700 mb-4">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-sage-600 hover:text-sage-700 ml-1">
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p className="text-warmgray-700 mb-4">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Haftung für Inhalte</h2>
            <p className="text-warmgray-700 mb-4">
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten
              nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
              Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
              Tätigkeit hinweisen.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Haftung für Links</h2>
            <p className="text-warmgray-700 mb-4">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
              Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
              Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
              Seiten verantwortlich.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Urheberrecht</h2>
            <p className="text-warmgray-700 mb-4">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
              dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
              Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung
              des jeweiligen Autors bzw. Erstellers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
