'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, History, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { SecurityAuditLog } from '@/types/database'

const DOCUMENT_AUDIT_EVENT_TYPES = [
  'document_viewed',
  'document_downloaded',
  'document_locked',
  'document_unlocked',
  'category_locked',
  'category_unlocked',
] as const

const EVENT_TYPE_LABELS: Record<string, string> = {
  document_viewed: 'Dokument angesehen',
  document_downloaded: 'Dokument heruntergeladen',
  document_locked: 'Dokument gesperrt',
  document_unlocked: 'Dokument entsperrt',
  category_locked: 'Kategorie gesperrt',
  category_unlocked: 'Kategorie entsperrt',
}

function getContextLabel(event: SecurityAuditLog): string {
  if (!event.event_data || typeof event.event_data !== 'object' || Array.isArray(event.event_data)) {
    return '-'
  }

  const eventData = event.event_data as Record<string, unknown>
  const categoryKey = eventData.category_key

  if (typeof categoryKey === 'string' && categoryKey.length > 0) {
    return categoryKey
  }

  return '-'
}

function getDocumentTitle(event: SecurityAuditLog): string {
  if (!event.event_data || typeof event.event_data !== 'object' || Array.isArray(event.event_data)) {
    return '-'
  }

  const eventData = event.event_data as Record<string, unknown>
  const documentTitle = eventData.document_title

  if (typeof documentTitle === 'string' && documentTitle.length > 0) {
    return documentTitle
  }

  return '-'
}

export function DocumentAuditLog() {
  const [events, setEvents] = useState<SecurityAuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchEvents() {
      setIsLoading(true)
      setError(null)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setEvents([])
          return
        }

        const { data, error: queryError } = await supabase
          .from('security_audit_log')
          .select('id, event_type, timestamp, event_data')
          .eq('user_id', user.id)
          .in('event_type', [...DOCUMENT_AUDIT_EVENT_TYPES])
          .order('timestamp', { ascending: false })
          .limit(100)

        if (queryError) {
          throw queryError
        }

        setEvents((data ?? []) as SecurityAuditLog[])
      } catch {
        setError('Dokumenten-Aktivitäten konnten nicht geladen werden.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchEvents()
  }, [])

  const visibleEvents = activeFilter
    ? events.filter((event) => event.event_type === activeFilter)
    : events

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-sage-600" />
          Dokumenten-Zugriffsprotokoll
        </CardTitle>
        <CardDescription>
          Verlauf von Dokument- und Kategorieaktionen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_AUDIT_EVENT_TYPES.map((eventType) => {
            const isActive = activeFilter === eventType
            return (
              <button
                key={eventType}
                type="button"
                onClick={() => {
                  setActiveFilter((prev) => (prev === eventType ? null : eventType))
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-sage-100 text-sage-700 border-sage-300'
                    : 'bg-white text-warmgray-600 border-warmgray-200'
                }`}
              >
                {EVENT_TYPE_LABELS[eventType]}
              </button>
            )
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-sage-600" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="py-8 text-center text-sm text-warmgray-500">
            Keine Einträge vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warmgray-200">
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700">Ereignis</th>
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700">Datum</th>
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700">Kategorie</th>
                  <th className="text-left py-2 px-2 font-medium text-warmgray-700">Dokumenttitel</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.id} className="border-b border-warmgray-100">
                    <td className="py-2 px-2 text-warmgray-900">
                      {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                    </td>
                    <td className="py-2 px-2 text-warmgray-500 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleString('de-DE')}
                    </td>
                    <td className="py-2 px-2 text-warmgray-500">
                      {getContextLabel(event)}
                    </td>
                    <td className="py-2 px-2 text-warmgray-500">
                      {getDocumentTitle(event)}
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
