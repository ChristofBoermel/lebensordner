'use client'

import { useState, useEffect } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'

type NudgeType = 'document' | 'folder' | 'trusted_person' | 'storage'

interface UpgradeNudgeProps {
  type: NudgeType
  currentCount: number
  maxCount: number
  className?: string
}

const nudgeContent: Record<NudgeType, {
  title: string
  getMessage: (current: number, max: number) => string
  benefit: string
}> = {
  document: {
    title: 'Gut zu wissen',
    getMessage: (current, max) =>
      `Sie haben ${current} von ${max} kostenlosen Dokumenten hochgeladen.`,
    benefit: 'Mit einem Upgrade können Sie unbegrenzt viele Dokumente sicher speichern.',
  },
  folder: {
    title: 'Gut zu wissen',
    getMessage: (current, max) =>
      `Sie haben ${current} von ${max} Ordnern erstellt.`,
    benefit: 'Mit einem Upgrade können Sie mehr Ordner anlegen und Ihre Dokumente besser organisieren.',
  },
  trusted_person: {
    title: 'Gut zu wissen',
    getMessage: (current, max) =>
      `Sie haben ${current} von ${max} Vertrauenspersonen hinzugefügt.`,
    benefit: 'Mit einem Upgrade können Sie weitere Vertrauenspersonen hinzufügen.',
  },
  storage: {
    title: 'Speicherplatz',
    getMessage: (current, max) =>
      `Sie nutzen ${current} von ${max} MB Speicherplatz.`,
    benefit: 'Mit einem Upgrade erhalten Sie mehr Speicherplatz für Ihre Dokumente.',
  },
}

export function UpgradeNudge({ type, currentCount, maxCount, className = '' }: UpgradeNudgeProps) {
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden until we check
  const { capture } = usePostHog()

  const storageKey = `upgrade_nudge_dismissed_${type}`
  const sessionKey = `upgrade_nudge_shown_${type}`

  // Check if nudge should be shown
  useEffect(() => {
    // Only show if we're at threshold (1 before limit)
    const isAtThreshold = currentCount === maxCount - 1

    // Don't show if limit is unlimited
    if (maxCount === -1 || !isAtThreshold) {
      setIsDismissed(true)
      return
    }

    // Check if dismissed permanently (localStorage) or this session
    const permanentlyDismissed = localStorage.getItem(storageKey) === 'true'
    const shownThisSession = sessionStorage.getItem(sessionKey) === 'true'

    if (permanentlyDismissed || shownThisSession) {
      setIsDismissed(true)
      return
    }

    // Show the nudge and mark as shown this session
    setIsDismissed(false)
    sessionStorage.setItem(sessionKey, 'true')

    // Track that nudge was shown
    capture(ANALYTICS_EVENTS.UPGRADE_NUDGE_SHOWN, {
      nudge_type: type,
      current_count: currentCount,
      max_count: maxCount,
    })
  }, [currentCount, maxCount, type, storageKey, sessionKey, capture])

  const handleDismiss = () => {
    setIsDismissed(true)
    // Store dismissal for this session only (not permanent)
    sessionStorage.setItem(sessionKey, 'true')

    capture(ANALYTICS_EVENTS.UPGRADE_NUDGE_DISMISSED, {
      nudge_type: type,
    })
  }

  const handleDismissPermanently = () => {
    setIsDismissed(true)
    localStorage.setItem(storageKey, 'true')

    capture(ANALYTICS_EVENTS.UPGRADE_NUDGE_DISMISSED, {
      nudge_type: type,
      permanent: true,
    })
  }

  const handleUpgradeClick = () => {
    capture(ANALYTICS_EVENTS.UPGRADE_NUDGE_CLICKED, {
      nudge_type: type,
    })
  }

  if (isDismissed) {
    return null
  }

  const content = nudgeContent[type]

  return (
    <div className={`rounded-xl border-2 border-blue-200 bg-blue-50 p-6 relative ${className}`}>
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-blue-100 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-5 h-5 text-blue-600" />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
          <Lightbulb className="w-6 h-6 text-blue-600" />
        </div>

        <div className="flex-1 pr-8">
          <h3 className="text-xl font-semibold text-blue-900 mb-2">
            {content.title}
          </h3>

          <p className="text-lg text-blue-800 mb-3">
            {content.getMessage(currentCount, maxCount)}
          </p>

          <p className="text-lg text-blue-700 mb-5">
            {content.benefit}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/abo" onClick={handleUpgradeClick}>
              <Button
                size="lg"
                className="text-lg px-6 py-3 h-auto bg-blue-600 hover:bg-blue-700"
              >
                Tarife ansehen
              </Button>
            </Link>

            <Button
              variant="outline"
              size="lg"
              onClick={handleDismissPermanently}
              className="text-lg px-6 py-3 h-auto border-2 border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Nicht mehr anzeigen
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
