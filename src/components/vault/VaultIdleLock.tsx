'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVault } from '@/lib/vault/VaultContext'
import { Lock } from 'lucide-react'

export function VaultIdleLock() {
  const vault = useVault()
  const { isUnlocked, lock } = vault
  const [supabase] = useState(() => createClient())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUnlockedRef = useRef(isUnlocked)
  const [timeoutMinutes, setTimeoutMinutes] = useState(15)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    isUnlockedRef.current = isUnlocked
  }, [isUnlocked])

  useEffect(() => {
    const fetchTimeout = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          setTimeoutMinutes(15)
          return
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('vault_idle_timeout_minutes')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setTimeoutMinutes(15)
          return
        }

        setTimeoutMinutes(data?.vault_idle_timeout_minutes ?? 15)
      } catch {
        setTimeoutMinutes(15)
      }
    }

    void fetchTimeout()
  }, [supabase])

  useEffect(() => {
    if (!isUnlocked || timeoutMinutes === 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const lockVault = () => {
      if (!isUnlockedRef.current) {
        return
      }

      lock()
      setShowBanner(true)
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current)
      }
      bannerTimerRef.current = setTimeout(() => {
        setShowBanner(false)
      }, 4000)
    }

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        lockVault()
      }, timeoutMinutes * 60 * 1000)
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
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer)
      })
      window.removeEventListener('focus', resetTimer)
      document.removeEventListener('visibilitychange', resetTimer)
    }
  }, [isUnlocked, lock, timeoutMinutes])

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current)
      }
    }
  }, [])

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[120] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <Lock className="h-5 w-5 text-slate-600 flex-shrink-0" />
        <p className="text-sm font-medium text-warmgray-900">🔒 Tresor automatisch gesperrt nach Inaktivität</p>
      </div>
    </div>
  )
}
