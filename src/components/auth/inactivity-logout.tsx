'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const WARNING_LEAD_MS = 60 * 1000

export function InactivityLogout() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSigningOutRef = useRef(false)
  const [showWarning, setShowWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.floor(WARNING_LEAD_MS / 1000),
  )

  useEffect(() => {
    const clearTimers = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }

    const signOutForInactivity = async () => {
      if (isSigningOutRef.current) return
      isSigningOutRef.current = true
      await supabase.auth.signOut()
      router.push('/anmelden?reason=inaktiv')
      router.refresh()
    }

    const startWarning = () => {
      setShowWarning(true)
      setRemainingSeconds(Math.floor(WARNING_LEAD_MS / 1000))
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((previous) => (previous > 0 ? previous - 1 : 0))
      }, 1000)
    }

    const resetTimer = () => {
      clearTimers()
      setShowWarning(false)
      setRemainingSeconds(Math.floor(WARNING_LEAD_MS / 1000))

      warningTimerRef.current = setTimeout(() => {
        startWarning()
      }, IDLE_TIMEOUT_MS - WARNING_LEAD_MS)

      timerRef.current = setTimeout(() => {
        void signOutForInactivity()
      }, IDLE_TIMEOUT_MS)
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true })
    })
    window.addEventListener('focus', resetTimer)
    document.addEventListener('visibilitychange', resetTimer)

    resetTimer()

    return () => {
      clearTimers()
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer)
      })
      window.removeEventListener('focus', resetTimer)
      document.removeEventListener('visibilitychange', resetTimer)
    }
  }, [router, supabase])

  if (!showWarning) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[120] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-lg border border-amber-200 bg-white p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-warmgray-900">
            Automatische Abmeldung in {remainingSeconds} Sekunden
          </p>
          <p className="mt-1 text-xs text-warmgray-600">
            Bleiben Sie aktiv, um Ihre Sitzung fortzusetzen.
          </p>
        </div>
        <Button size="sm" onClick={() => window.dispatchEvent(new Event('mousemove'))}>
          Aktiv bleiben
        </Button>
      </div>
    </div>
  )
}
