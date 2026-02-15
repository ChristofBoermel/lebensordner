'use client'

import Link from 'next/link'

export function PrivacyPolicyUpdateContent() {
  return (
    <div className="prose prose-warmgray max-w-none">
      <h2 className="text-xl font-semibold text-warmgray-900 mt-8 mb-4">Wichtige Änderungen</h2>
      <p className="text-warmgray-700 mb-4">
        Wir haben unsere Datenschutzerklärung aktualisiert, um transparenter darzustellen, wie wir Daten
        verarbeiten und welche Rechte Ihnen zustehen. Hier sind die wichtigsten Punkte:
      </p>
      <ul className="list-disc pl-6 text-warmgray-700 mb-6">
        <li>Klarstellung der Rechtsgrundlagen für zentrale Verarbeitungen</li>
        <li>Aktualisierung der Auftragsverarbeiter-Liste und Standorte</li>
        <li>Präzisierung der Speicherfristen für unterschiedliche Datenkategorien</li>
        <li>Ergänzung von Hinweisen zu Sicherheitsprotokollen und Protokollierung</li>
      </ul>
      <p className="text-warmgray-700 mb-6">
        <Link href="/datenschutz" className="text-sage-600 hover:text-sage-700">
          Vollständige Datenschutzerklärung anzeigen
        </Link>
      </p>

      <h3 className="text-lg font-semibold text-warmgray-900 mt-8 mb-3">Kontakt</h3>
      <p className="text-warmgray-700 mb-4">
        Verantwortlich für die Datenverarbeitung:
        <br />
        Christof Boermel
        <br />
        Lehmbrookweg 2
        <br />
        22159 Hamburg
        <br />
        E-Mail: matbo@matsbusiness.co.site
        <br />
        Telefon: +49 172 7553584
      </p>
    </div>
  )
}
