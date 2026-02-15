'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PrivacyPolicyUpdateContent } from '@/components/consent/privacy-policy-update-content'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'

const SCROLL_THRESHOLD = 24

type PolicyUpdateClientProps = {
  returnTo: string | null
  onboardingCompleted: boolean
}

export function PolicyUpdateClient({ returnTo, onboardingCompleted }: PolicyUpdateClientProps) {
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTarget = useMemo(() => {
    if (returnTo) return returnTo
    return onboardingCompleted ? '/dashboard' : '/onboarding'
  }, [onboardingCompleted, returnTo])

  const checkIfScrollable = useCallback(() => {
    const node = contentRef.current
    if (!node) return
    if (node.scrollHeight <= node.clientHeight + SCROLL_THRESHOLD) {
      setHasScrolledToBottom(true)
    }
  }, [])

  useEffect(() => {
    checkIfScrollable()
  }, [checkIfScrollable])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_THRESHOLD) {
      setHasScrolledToBottom(true)
    }
  }, [])

  const handleAccept = useCallback(async () => {
    setIsAccepting(true)
    setError(null)

    try {
      const response = await fetch('/api/consent/accept-privacy-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('request_failed')
      }

      router.replace(redirectTarget)
    } catch {
      setError('Die Einwilligung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.')
    } finally {
      setIsAccepting(false)
    }
  }, [redirectTarget, router])

  const canAccept = hasScrolledToBottom && checkboxChecked && !isAccepting

  return (
    <DialogPrimitive.Root open>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-warmgray-200 bg-cream-50 shadow-2xl">
            <div className="border-b border-warmgray-200 bg-white/80 px-6 py-6">
              <div className="text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-sage-700" />
                </div>
                <DialogTitle className="text-3xl font-serif font-semibold">
                  Datenschutzerklärung aktualisiert
                </DialogTitle>
                <DialogDescription className="text-warmgray-700 text-lg max-w-2xl mx-auto">
                  Wir haben unsere Datenschutzerklärung aktualisiert. Bitte lesen Sie die Änderungen und bestätigen Sie
                  anschließend Ihre Zustimmung.
                </DialogDescription>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <div
                ref={contentRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto px-6 py-6"
                data-testid="policy-update-content"
              >
                <PrivacyPolicyUpdateContent />
              </div>
            </div>

            <div className="border-t border-warmgray-200 bg-white/90 px-6 py-5 space-y-4">
              <label className="flex items-start gap-3 text-warmgray-800 text-base">
                <input
                  type="checkbox"
                  checked={checkboxChecked}
                  onChange={(event) => setCheckboxChecked(event.target.checked)}
                  data-testid="policy-update-checkbox"
                  className="mt-1 h-4 w-4 rounded border-warmgray-300 text-sage-600 focus:ring-sage-500"
                />
                <span>Ich habe die aktualisierte Datenschutzerklärung gelesen und stimme zu.</span>
              </label>

              {!hasScrolledToBottom && (
                <p className="text-sm text-warmgray-600">
                  Bitte scrollen Sie bis zum Ende, um die Einwilligung zu aktivieren.
                </p>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                  <Button variant="outline" onClick={handleAccept} disabled={isAccepting}>
                    Erneut versuchen
                  </Button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-sm text-warmgray-600">
                  Wenn Sie nicht zustimmen möchten, können Sie Ihr Konto in den Einstellungen löschen.
                </p>
                <Link href="/einstellungen" className="text-sm text-sage-700 underline">
                  Konto löschen
                </Link>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleAccept}
                  disabled={!canAccept}
                  size="lg"
                  data-testid="policy-update-accept"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    'Einwilligung speichern'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  )
}
