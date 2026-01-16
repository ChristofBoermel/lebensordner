'use client'

import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Cookie, Settings, Check, X } from 'lucide-react'
import { initPostHog, posthog } from '@/lib/posthog'

const CONSENT_COOKIE = 'lebensordner_consent'
const CONSENT_VERSION = '1.0'

interface ConsentSettings {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  version: string
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<ConsentSettings>({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
    version: CONSENT_VERSION,
  })

  useEffect(() => {
    const consent = Cookies.get(CONSENT_COOKIE)
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
          // Initialize PostHog if analytics consent given
          if (parsed.analytics) {
            initPostHog()
          }
        }
      } catch {
        setShowBanner(true)
      }
    }
  }, [])

  const saveConsent = (newSettings: ConsentSettings) => {
    Cookies.set(CONSENT_COOKIE, JSON.stringify(newSettings), { 
      expires: 365,
      sameSite: 'strict'
    })
    setSettings(newSettings)
    setShowBanner(false)
    setShowSettings(false)

    // Initialize or opt-out of PostHog based on consent
    if (newSettings.analytics) {
      initPostHog()
    } else if (posthog.__loaded) {
      posthog.opt_out_capturing()
    }
  }

  const acceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
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
            // Main Banner
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
                </div>
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
              </p>
            </div>
          ) : (
            // Detailed Settings
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
                {/* Necessary */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-warmgray-50">
                  <div>
                    <p className="font-medium text-warmgray-900">Notwendige Cookies</p>
                    <p className="text-xs text-warmgray-500">Erforderlich für die Grundfunktionen</p>
                  </div>
                  <div className="w-10 h-6 rounded-full bg-sage-600 flex items-center justify-end px-1">
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </div>
                </div>

                {/* Analytics */}
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

                {/* Marketing */}
                <label className="flex items-center justify-between p-3 rounded-lg bg-warmgray-50 cursor-pointer">
                  <div>
                    <p className="font-medium text-warmgray-900">Marketing-Cookies</p>
                    <p className="text-xs text-warmgray-500">Für personalisierte Inhalte</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, marketing: !settings.marketing })}
                    className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${
                      settings.marketing ? 'bg-sage-600 justify-end' : 'bg-warmgray-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </button>
                </label>
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
