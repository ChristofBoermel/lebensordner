'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, Download, Loader2, AlertTriangle } from 'lucide-react'
import type { SecurityAuditLog } from '@/types/database'

const EVENT_TYPE_LABELS: Record<string, string> = {
  login_success: 'Erfolgreiche Anmeldung',
  login_failure: 'Fehlgeschlagene Anmeldung',
  password_changed: 'Passwort geändert',
  password_reset_requested: 'Passwort-Reset angefordert',
  two_factor_enabled: '2FA aktiviert',
  two_factor_disabled: '2FA deaktiviert',
  unauthorized_access: 'Unberechtigter Zugriff',
  account_locked: 'Konto gesperrt',
  suspicious_activity: 'Verdächtige Aktivität',
  trusted_person_document_viewed: 'Dokument von VP angesehen',
  download_link_created: 'Download-Link erstellt',
  download_link_viewed: 'Download-Link geöffnet',
  gdpr_export_requested: 'GDPR-Export angefordert',
}

type FilterTab = 'all' | 'logins' | 'failed' | 'data_access'

const FILTER_MAP: Record<FilterTab, string | null> = {
  all: null,
  logins: 'login_success',
  failed: 'login_failure',
  data_access: 'trusted_person_document_viewed',
}

function formatEventType(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] || eventType
}

function truncateUserAgent(ua: string, maxLength = 60): string {
  if (!ua || ua === 'Unknown') return 'Unbekannt'
  return ua.length > maxLength ? ua.substring(0, maxLength) + '...' : ua
}

export function SecurityActivityLog() {
  const [events, setEvents] = useState<SecurityAuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const fetchEvents = useCallback(async (filter: FilterTab) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ limit: '50' })
      const eventType = FILTER_MAP[filter]
      if (eventType) {
        params.set('event_type', eventType)
      }

      const res = await fetch(`/api/security/audit-log?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Fehler beim Laden')
      }

      const data = await res.json()

      // For data_access filter, we need to fetch multiple event types
      if (filter === 'data_access') {
        const params2 = new URLSearchParams({ limit: '50', event_type: 'download_link_created' })
        const params3 = new URLSearchParams({ limit: '50', event_type: 'download_link_viewed' })

        const [res2, res3] = await Promise.all([
          fetch(`/api/security/audit-log?${params2.toString()}`),
          fetch(`/api/security/audit-log?${params3.toString()}`),
        ])

        const data2 = res2.ok ? await res2.json() : { events: [] }
        const data3 = res3.ok ? await res3.json() : { events: [] }

        const combined = [
          ...(data.events || []),
          ...(data2.events || []),
          ...(data3.events || []),
        ].sort((a: SecurityAuditLog, b: SecurityAuditLog) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        setEvents(combined)
      } else {
        setEvents(data.events || [])
      }
    } catch {
      setError('Aktivitäten konnten nicht geladen werden.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents(activeFilter)
  }, [activeFilter, fetchEvents])

  const handleFilterChange = (value: string) => {
    setActiveFilter(value as FilterTab)
  }

  const handleCsvExport = () => {
    if (events.length === 0) return

    const headers = ['Ereignis', 'Datum', 'IP-Adresse', 'User-Agent']
    const rows = events.map((event) => [
      formatEventType(event.event_type),
      new Date(event.timestamp).toLocaleString('de-DE'),
      event.ip_address || 'Unbekannt',
      event.user_agent || 'Unbekannt',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-log-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Card id="security-activity">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-sage-600" />
              Sicherheit & Aktivität
            </CardTitle>
            <CardDescription className="mt-1.5">
              Überwachen Sie Ihre Kontosicherheit und Aktivitäten
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCsvExport}
            disabled={events.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeFilter} onValueChange={handleFilterChange}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Alle</TabsTrigger>
            <TabsTrigger value="logins" className="flex-1">Anmeldungen</TabsTrigger>
            <TabsTrigger value="failed" className="flex-1">Fehlversuche</TabsTrigger>
            <TabsTrigger value="data_access" className="flex-1">Datenzugriff</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-warmgray-500 text-sm">
            Keine Aktivitäten gefunden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warmgray-200">
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700">Ereignis</th>
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700">Datum</th>
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700 hidden sm:table-cell">IP-Adresse</th>
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700 hidden md:table-cell">Gerät</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-warmgray-100">
                    <td className="py-2 px-2 text-warmgray-900">
                      {formatEventType(event.event_type)}
                    </td>
                    <td className="py-2 px-2 text-warmgray-500 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleString('de-DE')}
                    </td>
                    <td className="py-2 px-2 text-warmgray-500 hidden sm:table-cell">
                      {event.ip_address || 'Unbekannt'}
                    </td>
                    <td className="py-2 px-2 text-warmgray-500 hidden md:table-cell">
                      {truncateUserAgent(event.user_agent || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
