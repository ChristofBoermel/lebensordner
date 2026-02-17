'use client'

import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Cookie, Settings, Check, X, Info } from 'lucide-react'
import { CONSENT_VERSION, CONSENT_COOKIE_NAME } from '@/lib/consent/constants'
import { LayeredPrivacyNotice } from '@/components/consent/layered-privacy-notice'

// Phase 1: marketing consent is disabled. Set to true in a future phase to enable.
const MARKETING_ENABLED = false

interface ConsentSettings {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  version: string
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrivacySummary, setShowPrivacySummary] = useState(false)
  const [settings, setSettings] = useState<ConsentSettings>({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
    version: CONSENT_VERSION,
  })

  useEffect(() => {
    const consent = Cookies.get(CONSENT_COOKIE_NAME)
    if (!consent) {
      setShowBanner(true)
    } else {
      try {
        const parsed = JSON.parse(consent) as ConsentSettings
        // Check if consent version is outdated
        if (parsed.version !== CONSENT_VERSION) {
          setShowBanner(true)
        } else {
          setSettings(parsed)
          // Note: PostHog initialization is handled by PostHogProvider
          // which monitors cookie changes and initializes/opts-out accordingly
        }
      } catch {
        setShowBanner(true)
      }
    }
  }, [])

  const syncConsentToServer = async (newSettings: ConsentSettings) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const requests = []
      requests.push(
        fetch('/api/consent/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consentType: 'analytics',
            granted: newSettings.analytics,
            version: newSettings.version,
          }),
        })
      )

      // Phase 1: omit marketing consent record
      if (MARKETING_ENABLED) {
        requests.push(
          fetch('/api/consent/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              consentType: 'marketing',
              granted: newSettings.marketing,
              version: newSettings.version,
            }),
          })
        )
      }

      await Promise.allSettled(requests)
    } catch {
      // Silently handle errors to avoid blocking consent flow
    }
  }

  const saveConsent = (newSettings: ConsentSettings) => {
    // Phase 1: always force marketing to false
    if (!MARKETING_ENABLED) {
      newSettings = { ...newSettings, marketing: false }
    }
    Cookies.set(CONSENT_COOKIE_NAME, JSON.stringify(newSettings), {
      expires: 365,
      sameSite: 'strict'
    })
    setSettings(newSettings)
    setShowBanner(false)
    setShowSettings(false)

    // Note: PostHog initialization is handled by PostHogProvider
    // which monitors cookie changes and initializes/opts-out accordingly

    // Sync to server for logged-in users
    syncConsentToServer(newSettings)
  }

  const acceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: false,
      version: CONSENT_VERSION,
    })
  }

  const acceptNecessary = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      version: CONSENT_VERSION,
    })
  }

  const saveCustomSettings = () => {
    saveConsent(settings)
  }

  if (!showBanner) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center bg-black/50">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardContent className="pt-6">
          {!showSettings ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-5 h-5 text-sage-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-warmgray-900">Cookie-Einstellungen</h3>
                  <p className="text-sm text-warmgray-600 mt-1">
                    Wir verwenden Cookies, um Ihre Erfahrung zu verbessern und unsere Website zu analysieren. 
                    Sie können selbst entscheiden, welche Cookies Sie zulassen möchten.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPrivacySummary(!showPrivacySummary)}
                    aria-expanded={showPrivacySummary}
                    className="inline-flex items-center gap-2 mt-2 text-sm text-sage-600 hover:text-sage-700 hover:underline"
                  >
                    <Info className="w-4 h-4" aria-hidden="true" />
                    <span>Mehr erfahren</span>
                  </button>
                </div>
              </div>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  showPrivacySummary ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}
                aria-label="Datenschutz-Zusammenfassung"
                aria-hidden={!showPrivacySummary}
              >
                {showPrivacySummary && (
                  <div className="pt-4">
                    <LayeredPrivacyNotice onClose={() => setShowPrivacySummary(false)} />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={acceptAll} className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  Alle akzeptieren
                </Button>
                <Button onClick={acceptNecessary} variant="outline" className="flex-1">
                  Nur notwendige
                </Button>
                <Button 
                  onClick={() => setShowSettings(true)} 
                  variant="ghost"
                  size="icon"
                  title="Einstellungen"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-xs text-warmgray-500 text-center">
                <a href="/datenschutz" className="underline hover:text-warmgray-700">Datenschutzerklärung</a>
                {' · '}
                <a href="/impressum" className="underline hover:text-warmgray-700">Impressum</a>
                {' · '}
                <a href="/einstellungen#privacy" className="underline hover:text-warmgray-700">Einstellungen verwalten</a>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-warmgray-900">Cookie-Einstellungen</h3>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowSettings(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-warmgray-50">
                  <div>
                    <p className="font-medium text-warmgray-900">Notwendige Cookies</p>
                    <p className="text-xs text-warmgray-500">Erforderlich für die Grundfunktionen</p>
                  </div>
                  <div className="w-10 h-6 rounded-full bg-sage-600 flex items-center justify-end px-1">
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 rounded-lg bg-warmgray-50 cursor-pointer">
                  <div>
                    <p className="font-medium text-warmgray-900">Analyse-Cookies</p>
                    <p className="text-xs text-warmgray-500">Helfen uns, die Website zu verbessern</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, analytics: !settings.analytics })}
                    className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${
                      settings.analytics ? 'bg-sage-600 justify-end' : 'bg-warmgray-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </button>
                </label>

                <div className="flex items-center justify-between p-3 rounded-lg bg-warmgray-50">
                  <div>
                    <p className="font-medium text-warmgray-900">Marketing-Cookies</p>
                    <p className="text-xs text-warmgray-500">Derzeit nicht verfügbar</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-warmgray-400">Demnächst</span>
                    <div className="w-10 h-6 rounded-full bg-warmgray-200 flex items-center px-1 justify-start opacity-50 cursor-not-allowed">
                      <div className="w-4 h-4 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveCustomSettings} className="flex-1">
                  Auswahl speichern
                </Button>
                <Button onClick={acceptAll} variant="outline" className="flex-1">
                  Alle akzeptieren
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
