'use client'

import { useEffect, useRef, useCallback } from 'react'

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          theme?: 'light' | 'dark' | 'auto'
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

export default function TurnstileWidget({ onVerify }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const scriptLoadedRef = useRef(false)

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return
    if (widgetIdRef.current) return // Already rendered

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) {
      console.error('[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured')
      return
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      theme: 'light',
    })
  }, [onVerify])

  useEffect(() => {
    // Check if script is already loaded
    if (window.turnstile) {
      renderWidget()
      return
    }

    // Check if script tag already exists
    if (scriptLoadedRef.current) return
    const existingScript = document.querySelector(
      'script[src*="challenges.cloudflare.com/turnstile"]'
    )
    if (existingScript) {
      scriptLoadedRef.current = true
      window.onTurnstileLoad = renderWidget
      return
    }

    // Load the Turnstile script
    scriptLoadedRef.current = true
    window.onTurnstileLoad = renderWidget

    const script = document.createElement('script')
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderWidget])

  return (
    <div className="flex justify-center py-3">
      <div ref={containerRef} />
    </div>
  )
}
