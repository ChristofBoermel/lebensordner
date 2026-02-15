import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PRIVACY_POLICY_VERSION } from '@/lib/consent/constants'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 3600 // Cache for 1 hour (rarely changes)

export const metadata = {
  title: 'Datenschutzerklärung - Lebensordner Digital',
  description:
    'Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO (Art. 13-14) für Lebensordner Digital.',
}

const LAST_UPDATED = '14. Februar 2026'

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
            <p className="text-warmgray-600 mb-2">
              Version {PRIVACY_POLICY_VERSION}
            </p>
            <p className="text-warmgray-600 mb-6">Stand: {LAST_UPDATED}</p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">1. Verantwortlicher</h2>
            <p className="text-warmgray-700 mb-4">
              Verantwortlich für die Datenverarbeitung ist:<br />
              Christof Boermel<br />
              Lehmbrookweg 2<br />
              22159 Hamburg<br />
              Deutschland<br />
              E-Mail: matbo@matsbusiness.co.site<br />
              Telefon: +49 172 7553584
            </p>
            <p className="text-warmgray-700 mb-4">
              Ein Datenschutzbeauftragter ist gemäß Art. 37 DSGVO nicht erforderlich (Einzelunternehmer,
              &lt;100 Nutzer, &lt;20 Personen mit Datenzugriff).
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">
              2. Rechtsgrundlagen der Verarbeitung
            </h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4">Verarbeitungszweck</th>
                    <th className="text-left py-2">Rechtsgrundlage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 pr-4">Kontoerstellung</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Gesundheitsdaten</td>
                    <td className="py-2">Art. 9 Abs. 2 lit. a DSGVO (Ausdrückliche Einwilligung)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Zahlungsabwicklung</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Sicherheitsprotokolle</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">E-Mail-Versand</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Webanalyse</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">
              3. Kategorien personenbezogener Daten
            </h2>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>
                Stammdaten (Name, E-Mail, Telefon verschlüsselt, Adresse verschlüsselt,
                Geburtsdatum verschlüsselt)
              </li>
              <li>
                Gesundheitsdaten (Diagnosen, Medikamente, Allergien, Blutgruppe,
                Notfallkontakte - alle verschlüsselt)
              </li>
              <li>Dokumente (Dateien + Metadaten)</li>
              <li>Zahlungsdaten (Stripe Customer ID, keine Kreditkarten)</li>
              <li>Nutzungsdaten (Anmeldeversuche, pseudonymisierte IP)</li>
            </ul>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">
              4. Empfänger und Kategorien von Empfängern
            </h2>
            <p className="text-warmgray-700 mb-4">
              Vertrauenspersonen können auf Ihre Daten zugreifen (nur mit Ihrer Einwilligung).
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4">Auftragsverarbeiter</th>
                    <th className="text-left py-2 pr-4">Zweck</th>
                    <th className="text-left py-2 pr-4">Standort</th>
                    <th className="text-left py-2">DPA-Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 pr-4">Supabase Inc.</td>
                    <td className="py-2 pr-4">Datenbank, Auth, Storage</td>
                    <td className="py-2 pr-4">EU (Frankfurt)</td>
                    <td className="py-2">✅ DPA unterzeichnet</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Stripe Inc.</td>
                    <td className="py-2 pr-4">Zahlungsabwicklung</td>
                    <td className="py-2 pr-4">EU (Dublin)</td>
                    <td className="py-2">✅ DPA unterzeichnet</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Resend Inc.</td>
                    <td className="py-2 pr-4">E-Mail-Versand</td>
                    <td className="py-2 pr-4">USA (SCCs)</td>
                    <td className="py-2">⏳ DPA wird abgeschlossen</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">PostHog Inc.</td>
                    <td className="py-2 pr-4">Webanalyse (opt-in)</td>
                    <td className="py-2 pr-4">EU</td>
                    <td className="py-2">✅ DPA unterzeichnet</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Cloudflare Inc.</td>
                    <td className="py-2 pr-4">CAPTCHA</td>
                    <td className="py-2 pr-4">EU</td>
                    <td className="py-2">✅ DPA unterzeichnet</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Vercel Inc.</td>
                    <td className="py-2 pr-4">Hosting</td>
                    <td className="py-2 pr-4">EU (Frankfurt)</td>
                    <td className="py-2">⏳ DPA wird abgeschlossen</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">
              5. Datenübermittlung in Drittländer
            </h2>
            <p className="text-warmgray-700 mb-4">
              Grundsatz: Alle Daten werden in der EU/EEA verarbeitet. Ausnahme: Resend nutzt Server in den
              USA mit Standardvertragsklauseln (SCCs) gem. Art. 46 Abs. 2 lit. c DSGVO.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">6. Speicherdauer</h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4">Datenkategorie</th>
                    <th className="text-left py-2 pr-4">Speicherdauer</th>
                    <th className="text-left py-2">Rechtsgrundlage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 pr-4">Profildaten</td>
                    <td className="py-2 pr-4">Bis Kontolöschung</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. a DSGVO</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Gesundheitsdaten</td>
                    <td className="py-2 pr-4">Bis Kontolöschung</td>
                    <td className="py-2">Art. 9 Abs. 2 lit. a DSGVO</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Dokumente</td>
                    <td className="py-2 pr-4">Bis Kontolöschung</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. a DSGVO</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Sicherheitsprotokolle</td>
                    <td className="py-2 pr-4">90 Tage (anonymisiert nach Kontolöschung)</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. f DSGVO</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Einwilligungshistorie</td>
                    <td className="py-2 pr-4">Unbegrenzt (Nachweispflicht)</td>
                    <td className="py-2">Art. 7 Abs. 1 DSGVO</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Rate-Limiting-Daten</td>
                    <td className="py-2 pr-4">24 Stunden</td>
                    <td className="py-2">Art. 6 Abs. 1 lit. f DSGVO</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">7. Ihre Rechte</h2>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>
                Art. 15 DSGVO Auskunftsrecht:
                <Link href="/einstellungen" className="text-sage-600 hover:text-sage-700">
                  Einstellungen → Datenschutz → DSGVO-Export
                </Link>
              </li>
              <li>
                Art. 16 DSGVO Berichtigung:
                <Link href="/einstellungen" className="text-sage-600 hover:text-sage-700">
                  Einstellungen
                </Link>
              </li>
              <li>
                Art. 17 DSGVO Löschung:
                <Link href="/einstellungen" className="text-sage-600 hover:text-sage-700">
                  Einstellungen → Konto löschen
                </Link>
              </li>
              <li>Art. 18 DSGVO Einschränkung der Verarbeitung</li>
              <li>
                Art. 20 DSGVO Datenübertragbarkeit:
                <Link href="/einstellungen" className="text-sage-600 hover:text-sage-700">
                  JSON Export
                </Link>
              </li>
              <li>Art. 21 DSGVO Widerspruchsrecht</li>
              <li>
                Art. 7 Abs. 3 DSGVO Widerruf:
                <Link href="/einstellungen" className="text-sage-600 hover:text-sage-700">
                  Einstellungen → Datenschutz
                </Link>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-warmgray-900 mt-6 mb-3">
              Pflicht zur Bereitstellung und Folgen der Nichtbereitstellung
            </h3>
            <p className="text-warmgray-700 mb-4">
              Informationen gemäß Art. 13 Abs. 2 lit. e DSGVO zur Pflicht zur Bereitstellung:
            </p>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>
                Profil: vertraglich erforderlich zur Kontoerstellung und Nutzung des Dienstes; ohne Angabe
                ist eine Registrierung und damit die Nutzung von Lebensordner Digital nicht möglich.
              </li>
              <li>
                Gesundheitsdaten: freiwillig; ohne Angabe sind Funktionen wie Gesundheitsprofil,
                Notfallinformationen und medizinische Übersichten nicht verfügbar.
              </li>
              <li>
                Zahlungsdaten: vertraglich erforderlich für den Abschluss und die Abwicklung
                kostenpflichtiger Leistungen; ohne Angabe ist kein Abschluss oder Fortbestand eines
                kostenpflichtigen Abonnements möglich.
              </li>
              <li>
                Dokumente: freiwillig; ohne Bereitstellung ist die Dokumentenverwaltung (Upload, Ablage,
                Teilen) nicht nutzbar.
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-warmgray-900 mt-6 mb-3">
              Datenquelle bei indirekter Erhebung
            </h3>
            <p className="text-warmgray-700 mb-4">
              Informationen gemäß Art. 14 Abs. 2 lit. f DSGVO: Wenn Nutzerinnen und Nutzer
              Vertrauenspersonen einladen, erhalten wir die Kontaktangaben der eingeladenen Person
              (z. B. Name und E-Mail-Adresse) von der einladenden Nutzerin bzw. dem einladenden Nutzer.
              Diese Daten stammen nicht aus öffentlich zugänglichen Quellen.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">8. Beschwerderecht</h2>
            <p className="text-warmgray-700 mb-4">
              Sie haben das Recht, sich bei einer Aufsichtsbehörde zu beschweren. Zuständig für Hamburg ist:
              <br />
              Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit<br />
              Ludwig-Erhard-Straße 22, 20459 Hamburg<br />
              E-Mail: mailbox@datenschutz.hamburg.de<br />
              Telefon: +49 40 428 54-4040<br />
              Website: https://datenschutz-hamburg.de
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">
              9. Automatisierte Entscheidungsfindung
            </h2>
            <p className="text-warmgray-700 mb-4">
              Wir setzen keine automatisierte Entscheidungsfindung oder Profiling im Sinne von Art. 22 DSGVO ein.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">10. Datensicherheit</h2>
            <ul className="list-disc pl-6 text-warmgray-700 mb-4">
              <li>Verschlüsselung: AES-256-GCM (Daten), TLS 1.3 (Übertragung)</li>
              <li>Zugriffskontrolle: Row-Level Security, RBAC</li>
              <li>Authentifizierung: Passwort + optionale 2FA</li>
              <li>Rate Limiting: Brute-Force-Schutz</li>
              <li>Audit-Logging: Sicherheitsrelevante Ereignisse</li>
              <li>Pseudonymisierung: IP-Adressen maskiert</li>
            </ul>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">11. Cookies</h2>
            <p className="text-warmgray-700 mb-4">
              Wir verwenden technisch notwendige Cookies für die Funktionalität sowie optionale Analyse-Cookies
              (PostHog) mit Opt-In.
            </p>

            <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">
              12. Änderungen dieser Datenschutzerklärung
            </h2>
            <p className="text-warmgray-700 mb-4">
              Änderungen erfolgen bei Rechtsänderungen oder Dienständerungen. Die aktuelle Version ist stets
              unter dieser URL verfügbar.
            </p>
            <p className="text-warmgray-600 mb-6">
              Version {PRIVACY_POLICY_VERSION} · Stand: {LAST_UPDATED}
            </p>

            <p className="text-warmgray-600">
              Diese Datenschutzerklärung wurde nach bestem Wissen erstellt. Eine anwaltliche Prüfung wird
              empfohlen.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
