'use client'

import { Button } from '@/components/ui/button'

interface LayeredPrivacyNoticeProps {
  onClose: () => void
}

const privacyPoints = [
  {
    icon: '📊',
    title: 'Welche Daten sammeln wir?',
    description: 'Name, E-Mail, hochgeladene Dokumente, Gesundheitsdaten (nur mit Ihrer Einwilligung)',
  },
  {
    icon: '🎯',
    title: 'Warum sammeln wir Daten?',
    description: 'Um Ihnen sichere Dokumentenverwaltung und Notfallzugriff für Vertrauenspersonen zu ermöglichen',
  },
  {
    icon: '🔒',
    title: 'Wie schützen wir Ihre Daten?',
    description: 'AES-256-Verschlüsselung, EU-Speicherung, Zugriffskontrolle, Audit-Protokollierung',
  },
  {
    icon: '⚖️',
    title: 'Ihre Rechte',
    description: 'Auskunft, Berichtigung, Löschung, Datenübertragbarkeit, Widerruf der Einwilligung',
  },
]

export function LayeredPrivacyNotice({ onClose }: LayeredPrivacyNoticeProps) {
  return (
    <section className="rounded-lg border border-sage-200 bg-sage-50 p-4 sm:p-6 max-h-[400px] overflow-y-auto">
      <h4 className="text-sm font-semibold text-warmgray-900">Datenschutz auf einen Blick</h4>

      <div className="mt-4 space-y-4">
        {privacyPoints.map((point) => (
          <div key={point.title} className="flex gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-lg flex-shrink-0"
              aria-hidden="true"
            >
              {point.icon}
            </div>
            <div className="flex-1">
              <p className="font-medium text-warmgray-900 text-sm mb-1">{point.title}</p>
              <p className="text-xs text-warmgray-600">{point.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-sage-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <a
          href="/datenschutz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-sage-600 hover:underline"
        >
          Vollständige Datenschutzerklärung
        </a>
        <Button variant="outline" onClick={onClose}>
          Verstanden
        </Button>
      </div>
    </section>
  )
}
