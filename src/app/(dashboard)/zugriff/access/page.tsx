'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function AccessPageInner() {
  const searchParams = useSearchParams()
  const ownerId = searchParams.get('ownerId')
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const rk = window.location.hash ? window.location.hash.slice(1) : ''

    if (!ownerId || !/^[0-9a-f]{64}$/i.test(rk)) {
      setStatus('error')
      return
    }

    localStorage.setItem(`rk_${ownerId}`, rk)
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setStatus('success')

    const timeoutId = window.setTimeout(() => {
      router.push(`/vp-dashboard/view/${ownerId}`)
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [ownerId, router])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      {status === 'loading' && (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-slate-700 shadow-sm">
          Zugriff wird eingerichtet...
        </div>
      )}
      {status === 'success' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-800 shadow-sm">
          Zugriff auf Dokumente wurde eingerichtet.
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
          Ungültiger Zugriffslink. Bitten Sie den Besitzer, Ihnen den Link erneut
          zu senden.
        </div>
      )}
    </div>
  )
}

export default function AccessPage() {
  return (
    <Suspense fallback={<div>Laden...</div>}>
      <AccessPageInner />
    </Suspense>
  )
}
