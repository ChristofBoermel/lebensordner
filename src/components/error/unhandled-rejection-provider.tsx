'use client'

import { useEffect } from 'react'

export function UnhandledRejectionProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    const handler = (event: PromiseRejectionEvent) => {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_type: 'unhandled_rejection',
          error_message: event.reason?.message ?? String(event.reason),
          error_id: `ERR-${Date.now()}`,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        }),
      }).catch(() => {})
    }

    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return null
}
