'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Lock, AlertTriangle, Loader2, CheckCircle2, Bell, Clock } from 'lucide-react'
import Link from 'next/link'

interface TrustedPerson {
  id: string
  name: string
  email: string
  relationship: string
  invitation_status: string
}

interface EmergencySettings {
  enabled: boolean
  days: 30 | 60 | 90
  trustedPersonId: string | null
  notifiedAt: string | null
  lastActiveAt: string | null
  trustedPersons: TrustedPerson[]
}

interface EmergencyAccessSettingsProps {
  isVorsorgeTier: boolean
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Unbekannt'
  const diff = Date.now() - new Date(isoString).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7) return `Vor ${days} Tagen`
  if (days < 30) return `Vor ${Math.floor(days / 7)} Wochen`
  return `Vor ${Math.floor(days / 30)} Monaten`
}

export function EmergencyAccessSettings({ isVorsorgeTier }: EmergencyAccessSettingsProps) {
  const [settings, setSettings] = useState<EmergencySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testSentAt, setTestSentAt] = useState<number | null>(null)

  // Local editable state
  const [enabled, setEnabled] = useState(false)
  const [days, setDays] = useState<30 | 60 | 90>(60)
  const [trustedPersonId, setTrustedPersonId] = useState<string | null>(null)

  // allowed: I/O - fetch emergency access settings on mount
  useEffect(() => {
    if (!isVorsorgeTier) {
      setLoading(false)
      return
    }

    fetch('/api/emergency-access/settings')
      .then((res) => {
        if (!res.ok) throw new Error('Laden fehlgeschlagen')
        return res.json()
      })
      .then((data: EmergencySettings) => {
        setSettings(data)
        setEnabled(data.enabled)
        setDays(data.days ?? 60)
        setTrustedPersonId(data.trustedPersonId)
      })
      .catch(() => setError('Einstellungen konnten nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [isVorsorgeTier])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/emergency-access/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, days, trustedPersonId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'trusted_person_required') {
          setError('Bitte wählen Sie eine Vertrauensperson aus.')
        } else if (data.error === 'trusted_person_not_accepted') {
          setError('Die ausgewählte Person hat die Einladung noch nicht angenommen.')
        } else {
          setError('Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.')
        }
        return
      }

      setSettings((prev) => prev ? { ...prev, ...data } : data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendTest() {
    setTestSending(true)
    setError(null)

    try {
      const res = await fetch('/api/emergency-access/test', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Testbenachrichtigung fehlgeschlagen.')
        return
      }

      setTestSentAt(Date.now())
    } catch {
      setError('Testbenachrichtigung fehlgeschlagen.')
    } finally {
      setTestSending(false)
    }
  }

  const testCooldownActive = testSentAt !== null && Date.now() - testSentAt < 24 * 60 * 60 * 1000
  const acceptedPersons = settings?.trustedPersons?.filter((p) => p.invitation_status === 'accepted') ?? []
  const selectedPerson = acceptedPersons.find((p) => p.id === trustedPersonId)

  // Locked state for non-Vorsorge users
  if (!isVorsorgeTier) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warmgray-900">
            <Shield className="w-5 h-5 text-warmgray-400" />
            Notfallzugang
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-warmgray-50 border border-warmgray-200">
            <Lock className="w-5 h-5 text-warmgray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warmgray-700">
                Verfügbar ab dem Vorsorge-Tarif
              </p>
              <p className="text-sm text-warmgray-500 mt-1">
                Wenn Sie sich längere Zeit nicht einloggen, werden Ihre Vertrauenspersonen automatisch benachrichtigt und erhalten Zugang.
              </p>
              <Link
                href="/abo"
                className="inline-flex items-center mt-3 text-sm font-medium text-sage-600 hover:text-sage-700"
              >
                Jetzt upgraden →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-warmgray-400" />
        </CardContent>
      </Card>
    )
  }

  // No accepted trusted persons
  if (!loading && acceptedPersons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warmgray-900">
            <Shield className="w-5 h-5 text-sage-600" />
            Notfallzugang
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Keine bestätigte Vertrauensperson vorhanden
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Laden Sie zuerst eine Vertrauensperson ein und warten Sie auf deren Bestätigung, bevor Sie den Notfallzugang aktivieren.
              </p>
              <Link
                href="/zugriff"
                className="inline-flex items-center mt-3 text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                Vertrauenspersonen verwalten →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warmgray-900">
          <Shield className="w-5 h-5 text-sage-600" />
          Notfallzugang
        </CardTitle>
        <p className="text-sm text-warmgray-500 mt-1">
          Wenn Sie sich für eine bestimmte Zeit nicht einloggen, wird Ihre Vertrauensperson automatisch benachrichtigt und erhält Zugang zu Ihren Dokumenten.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Last active */}
        {settings?.lastActiveAt && (
          <div className="flex items-center gap-2 text-sm text-warmgray-500">
            <Clock className="w-4 h-4" />
            <span>Zuletzt aktiv: {formatRelativeTime(settings.lastActiveAt)}</span>
          </div>
        )}

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-warmgray-900">Notfallzugang aktivieren</p>
            <p className="text-xs text-warmgray-500 mt-0.5">
              {enabled ? 'Aktiv — Ihre Vertrauensperson wird bei Inaktivität benachrichtigt' : 'Inaktiv'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2 ${
              enabled ? 'bg-sage-600' : 'bg-warmgray-200'
            }`}
            aria-checked={enabled}
            role="switch"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            {/* Inactivity period */}
            <div>
              <p className="text-sm font-medium text-warmgray-900 mb-2">Inaktivitätsfrist</p>
              <div className="flex gap-2">
                {([30, 60, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      days === d
                        ? 'bg-sage-600 text-white border-sage-600'
                        : 'bg-white text-warmgray-700 border-warmgray-200 hover:bg-warmgray-50'
                    }`}
                  >
                    {d} Tage
                  </button>
                ))}
              </div>
              {days === 60 && (
                <p className="text-xs text-warmgray-400 mt-1">Standard — empfohlen</p>
              )}
            </div>

            {/* Trusted person selector */}
            <div>
              <p className="text-sm font-medium text-warmgray-900 mb-2">Zu benachrichtigende Person</p>
              <select
                value={trustedPersonId ?? ''}
                onChange={(e) => setTrustedPersonId(e.target.value || null)}
                className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-sm text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
              >
                <option value="">Person auswählen…</option>
                {acceptedPersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Test notification button */}
            {trustedPersonId && selectedPerson && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={testSending || testCooldownActive}
                  className="flex items-center gap-2"
                >
                  {testSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {testCooldownActive
                    ? 'Testbenachrichtigung gesendet'
                    : 'Testbenachrichtigung senden'}
                </Button>
                {testCooldownActive && (
                  <p className="text-xs text-warmgray-400 mt-1">
                    Testbenachrichtigung an {selectedPerson.name} gesendet. Nächste in 24 Stunden möglich.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Save */}
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Speichern
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-sage-600">
              <CheckCircle2 className="w-4 h-4" />
              Gespeichert
            </span>
          )}
        </div>

        {/* Notified state */}
        {settings?.notifiedAt && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            Ihre Vertrauensperson wurde {formatRelativeTime(settings.notifiedAt)} benachrichtigt.
            Dieser Status wird automatisch zurückgesetzt, wenn Sie sich wieder einloggen.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
