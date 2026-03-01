'use client'

import { Children, createContext, isValidElement, use, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface ConsentModalContextValue {
  isLoading: boolean
  isConfirmed: boolean
  setIsConfirmed: (value: boolean) => void
  onAccept: () => Promise<void>
  onDecline: (() => void) | undefined
  hasCheckbox: boolean
}

const ConsentModalContext = createContext<ConsentModalContextValue | null>(null)

function useConsentModalContext() {
  const context = use(ConsentModalContext)
  if (!context) {
    throw new Error('ConsentModal compound components must be used within ConsentModal')
  }
  return context
}

export interface ConsentModalProps {
  isOpen: boolean
  onAccept: () => Promise<void>
  onDecline?: () => void
  testId?: string
  children: ReactNode
}

interface ConsentModalHeaderProps {
  children: ReactNode
}

interface ConsentModalBodyProps {
  children: ReactNode
}

interface ConsentModalCheckboxProps {
  label: string
}

type ConsentModalComponent = ((props: ConsentModalProps) => ReactNode) & {
  Header: (props: ConsentModalHeaderProps) => ReactNode
  Body: (props: ConsentModalBodyProps) => ReactNode
  Checkbox: (props: ConsentModalCheckboxProps) => ReactNode
  Footer: () => ReactNode
}

const ConsentModalRoot = ({
  isOpen,
  onAccept,
  onDecline,
  testId,
  children,
}: ConsentModalProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const hasCheckbox = containsConsentCheckbox(children)
  const isDismissEnabled = Boolean(onDecline)

  async function handleAccept() {
    setIsLoading(true)
    try {
      await onAccept()
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && onDecline) {
      onDecline()
    }
  }

  return (
    <ConsentModalContext value={{ isLoading, isConfirmed, setIsConfirmed, onAccept: handleAccept, onDecline, hasCheckbox }}>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          data-testid={testId ?? 'consent-modal'}
          showCloseButton={isDismissEnabled}
          onEscapeKeyDown={(event) => {
            if (!isDismissEnabled) {
              event.preventDefault()
            }
          }}
          onPointerDownOutside={(event) => {
            if (!isDismissEnabled) {
              event.preventDefault()
            }
          }}
        >
          {children}
        </DialogContent>
      </Dialog>
    </ConsentModalContext>
  )
}

function ConsentModalHeader({ children }: ConsentModalHeaderProps) {
  return (
    <DialogHeader>
      <DialogTitle>{children}</DialogTitle>
    </DialogHeader>
  )
}

function ConsentModalBody({ children }: ConsentModalBodyProps) {
  return <div className="space-y-3 text-sm text-warmgray-600">{children}</div>
}

function ConsentModalCheckbox({ label }: ConsentModalCheckboxProps) {
  const { isConfirmed, setIsConfirmed } = useConsentModalContext()

  return (
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
          {label}
        </Label>
      </div>
    </div>
  )
}

function ConsentModalFooter() {
  const { isLoading, isConfirmed, onAccept, onDecline, hasCheckbox } = useConsentModalContext()
  const isAcceptDisabled = isLoading || (hasCheckbox && !isConfirmed)

  return (
    <DialogFooter>
      {onDecline ? (
        <Button variant="outline" onClick={onDecline} disabled={isLoading}>
          Ablehnen
        </Button>
      ) : null}
      <Button onClick={onAccept} disabled={isAcceptDisabled}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Wird gespeichert...
          </>
        ) : (
          'Ich stimme zu'
        )}
      </Button>
    </DialogFooter>
  )
}

export const ConsentModal = ConsentModalRoot as ConsentModalComponent
ConsentModal.Header = ConsentModalHeader
ConsentModal.Body = ConsentModalBody
ConsentModal.Checkbox = ConsentModalCheckbox
ConsentModal.Footer = ConsentModalFooter

function containsConsentCheckbox(node: ReactNode): boolean {
  return Children.toArray(node).some((child) => {
    if (!isValidElement(child)) {
      return false
    }
    if (child.type === ConsentModalCheckbox) {
      return true
    }
    const props = child.props as { children?: ReactNode }
    return containsConsentCheckbox(props.children)
  })
}
