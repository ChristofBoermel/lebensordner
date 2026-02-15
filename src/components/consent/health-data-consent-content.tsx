'use client'

export function HealthDataConsentContent() {
  return (
    <div className="space-y-3 text-sm text-warmgray-600">
      <p>
        Für die Nutzung der Notfall- und Gesundheitsfunktionen müssen wir besondere Kategorien
        personenbezogener Daten verarbeiten. Dazu gehören medizinische Informationen wie
        Allergien, Diagnosen, Medikamente und Notfallkontakte.
      </p>
      <p>
        Die Verarbeitung erfolgt ausschließlich, um Ihnen die Notfallfunktion bereitzustellen
        und im Ernstfall wichtige Informationen schnell verfügbar zu machen.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Ihre Daten werden verschlüsselt gespeichert und nur Ihnen angezeigt.</li>
        <li>Sie können Ihre Einwilligung jederzeit in den Einstellungen widerrufen.</li>
        <li>Ohne Einwilligung können Gesundheitsdaten nicht gespeichert werden.</li>
      </ul>
    </div>
  )
}
