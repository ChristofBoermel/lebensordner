'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export interface ConsentModalProps {
  isOpen: boolean
  onAccept: () => Promise<void>
  onDecline?: () => void
  title: string
  description?: string
  content?: ReactNode
  acceptButtonText?: string
  declineButtonText?: string
  requireCheckbox?: boolean
  checkboxLabel?: string
  canDismiss?: boolean
  type?: string
  testId?: string
}

export function ConsentModal({
  isOpen,
  onAccept,
  onDecline,
  title,
  description,
  content,
  acceptButtonText = 'Ich stimme zu',
  declineButtonText = 'Ablehnen',
  requireCheckbox = false,
  checkboxLabel,
  canDismiss = true,
  type,
  testId,
}: ConsentModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)

  const handleAccept = useCallback(async () => {
    setIsLoading(true)
    try {
      await onAccept()
    } finally {
      setIsLoading(false)
    }
  }, [onAccept])

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmed(false)
      setIsLoading(false)
    }
  }, [isOpen])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (!canDismiss) return
      if (onDecline) onDecline()
    }
  }

  const isAcceptDisabled = isLoading || (requireCheckbox && !isConfirmed)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={canDismiss ? undefined : '[&>button]:hidden'}
        data-testid={testId ?? (type ? `consent-modal-${type}` : 'consent-modal')}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description
            ? <DialogDescription>{description}</DialogDescription>
            : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>

        {content ? (
          <div className="space-y-3 text-sm text-warmgray-600">
            {content}
          </div>
        ) : null}

        {requireCheckbox && checkboxLabel ? (
          <div className="rounded-lg border border-warmgray-200 bg-warmgray-50 p-3">
            <div className="flex items-start gap-3">
              <input
                id="consent_confirm"
                type="checkbox"
                checked={isConfirmed}
                onChange={(event) => setIsConfirmed(event.target.checked)}
                className="w-4 h-4 rounded border border-warmgray-400 bg-white text-sage-600 mt-0.5"
              />
              <Label htmlFor="consent_confirm" className="text-sm text-warmgray-700">
                {checkboxLabel}
              </Label>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {onDecline ? (
            <Button variant="outline" onClick={onDecline} disabled={isLoading}>
              {declineButtonText}
            </Button>
          ) : null}
          <Button onClick={handleAccept} disabled={isAcceptDisabled}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              acceptButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
