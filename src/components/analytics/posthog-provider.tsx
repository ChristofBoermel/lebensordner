'use client'

import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { initPostHog, posthog } from '@/lib/posthog/client'

const CONSENT_COOKIE = 'lebensordner_consent'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)

  // Check consent cookie on mount
  useEffect(() => {
    const consent = Cookies.get(CONSENT_COOKIE)
    if (consent) {
      try {
        const parsed = JSON.parse(consent)
        setAnalyticsEnabled(parsed.analytics === true)
      } catch {
        setAnalyticsEnabled(false)
      }
    }
  }, [])

  // Initialize PostHog only when analytics consent is granted
  useEffect(() => {
    if (analyticsEnabled) {
      initPostHog()
    }
  }, [analyticsEnabled])

  // Track page views on route change (only if analytics enabled)
  useEffect(() => {
    if (analyticsEnabled && pathname && posthog.__loaded) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url += '?' + searchParams.toString()
      }
      posthog.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams, analyticsEnabled])

  return <>{children}</>
}
