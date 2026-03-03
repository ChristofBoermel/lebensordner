'use client'

import { useEffect } from 'react'

export function UnhandledRejectionProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    const handler = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message ?? String(event.reason)
      if (message.includes('A listener indicated an asynchronous response by returning true')) {
        return
      }

      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_type: 'unhandled_rejection',
          error_message: message,
          error_id: `ERR-${Date.now()}`,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          pathname: window.location.pathname,
          href: window.location.href,
          release: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.NEXT_PUBLIC_COMMIT_SHA,
          source: 'unhandled_rejection',
        }),
      }).catch(() => {})
    }

    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return null
}
