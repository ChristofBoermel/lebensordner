'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { initPostHog, posthog } from '@/lib/posthog/client'
import { CONSENT_COOKIE_NAME } from '@/lib/consent/constants'

function getAnalyticsConsent(): boolean {
  const consent = Cookies.get(CONSENT_COOKIE_NAME)
  if (!consent) return false
  try {
    const parsed = JSON.parse(consent)
    return parsed.analytics === true
  } catch {
    return false
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
  const prevAnalyticsRef = useRef<boolean | null>(null)

  // Check consent cookie on mount and poll for changes
  useEffect(() => {
    const checkConsent = () => {
      const current = getAnalyticsConsent()
      if (current !== prevAnalyticsRef.current) {
        prevAnalyticsRef.current = current
        setAnalyticsEnabled(current)
      }
    }

    // Initial check
    checkConsent()

    // Poll for cookie changes every 1.5 seconds
    const interval = setInterval(checkConsent, 1500)
    return () => clearInterval(interval)
  }, [])

  // Initialize or opt-out of PostHog based on consent changes
  useEffect(() => {
    if (analyticsEnabled) {
      initPostHog()
      if (posthog.__loaded && posthog.has_opted_out_capturing()) {
        posthog.opt_in_capturing()
      }
    } else if (posthog.__loaded) {
      posthog.opt_out_capturing()
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
