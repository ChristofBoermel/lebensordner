'use client'

import { useEffect, useRef, useImperativeHandle } from 'react'

export interface TurnstileWidgetRef {
  reset: () => void
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  ref?: React.Ref<TurnstileWidgetRef>
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

function TurnstileWidget({ onVerify, ref }: TurnstileWidgetProps & { ref?: React.Ref<TurnstileWidgetRef> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const scriptLoadedRef = useRef(false)

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }), [])

  useEffect(() => {
    // Check if script is already loaded
    if (window.turnstile) {
      if (!containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) return
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
      return
    }

    // Check if script tag already exists
    if (scriptLoadedRef.current) return
    const existingScript = document.querySelector(
      'script[src*="challenges.cloudflare.com/turnstile"]'
    )
    if (existingScript) {
      scriptLoadedRef.current = true
      window.onTurnstileLoad = () => {
        if (!containerRef.current || !window.turnstile) return
        if (widgetIdRef.current) return
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
      }
      return
    }

    // Load the Turnstile script
    scriptLoadedRef.current = true
    window.onTurnstileLoad = () => {
      if (!containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) return
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
    }

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
  }, [onVerify])

  return (
    <div className="flex justify-center py-3">
      <div ref={containerRef} />
    </div>
  )
}

export default TurnstileWidget
