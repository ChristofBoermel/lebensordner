'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface StepFeedbackWidgetProps {
  stepName: string
  onSubmit: (data: { clarityRating: number; comments: string; timeSpentSeconds: number }) => void
  onSkip: () => void
  timeSpentSeconds: number
  open: boolean
}

const RATING_OPTIONS = [
  { value: 1, emoji: '\u{1F61F}', label: 'Sehr unklar' },
  { value: 2, emoji: '\u{1F615}', label: 'Etwas unklar' },
  { value: 3, emoji: '\u{1F610}', label: 'Neutral' },
  { value: 4, emoji: '\u{1F642}', label: 'Klar' },
  { value: 5, emoji: '\u{1F60A}', label: 'Sehr klar' },
]

export function StepFeedbackWidget({
  stepName,
  onSubmit,
  onSkip,
  timeSpentSeconds,
  open,
}: StepFeedbackWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [comments, setComments] = useState('')
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  // Focus first rating button when dialog opens
  useEffect(() => {
    if (open && firstButtonRef.current) {
      const timer = setTimeout(() => {
        firstButtonRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRating(null)
      setComments('')
    }
  }, [open])

  const handleSubmit = () => {
    if (selectedRating === null) return
    onSubmit({
      clarityRating: selectedRating,
      comments,
      timeSpentSeconds,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onSkip()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onSkip() }}>
      <DialogContent
        className="max-w-md"
        onKeyDown={handleKeyDown}
        aria-label={`Feedback für Schritt: ${stepName}`}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif text-center">
            War dieser Schritt klar und verst&auml;ndlich?
          </DialogTitle>
          <DialogDescription className="text-lg leading-relaxed text-warmgray-700 text-center pt-2">
            Ihre R&uuml;ckmeldung hilft uns, die Einrichtung zu verbessern.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating buttons */}
          <div
            className="flex justify-center gap-3"
            role="radiogroup"
            aria-label="Klarheitsbewertung"
          >
            {RATING_OPTIONS.map((option, index) => (
              <button
                key={option.value}
                ref={index === 0 ? firstButtonRef : undefined}
                type="button"
                role="radio"
                aria-checked={selectedRating === option.value}
                aria-label={option.label}
                onClick={() => setSelectedRating(option.value)}
                className={`
                  w-14 h-14 rounded-full text-2xl flex items-center justify-center
                  transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4
                  ${selectedRating === option.value
                    ? 'bg-sage-100 border-[3px] border-sage-600 scale-110 shadow-md'
                    : 'bg-warmgray-100 border-2 border-warmgray-300 hover:bg-warmgray-200 hover:border-warmgray-400'
                  }
                `}
              >
                <span aria-hidden="true">{option.emoji}</span>
              </button>
            ))}
          </div>

          {/* Rating label */}
          {selectedRating !== null && (
            <p className="text-center text-lg font-medium text-sage-700" aria-live="polite">
              {RATING_OPTIONS.find(o => o.value === selectedRating)?.label}
            </p>
          )}

          {/* Optional comments */}
          <div>
            <label htmlFor="feedback-comments" className="block text-lg font-medium text-warmgray-900 mb-2">
              M&ouml;chten Sie uns etwas mitteilen?
            </label>
            <textarea
              id="feedback-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional: Ihre Anmerkungen..."
              className="w-full min-h-[80px] rounded-md border-2 border-warmgray-300 bg-white px-4 py-3 text-lg text-gray-900 transition-colors placeholder:text-warmgray-500 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-[3px] focus-visible:ring-sage-100 focus-visible:ring-offset-4"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={selectedRating === null}
            size="onboarding"
            className="min-h-[44px] flex-1"
          >
            Absenden
          </Button>
          <Button
            variant="ghost"
            onClick={onSkip}
            size="onboarding"
            className="min-h-[44px] flex-1 text-warmgray-700"
          >
            &Uuml;berspringen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
