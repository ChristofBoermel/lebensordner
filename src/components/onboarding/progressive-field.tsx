'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HelpTooltip } from '@/components/onboarding/help-tooltip'
import { ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const ENCOURAGEMENTS = ['Gut gemacht!', 'Weiter so!', 'Super!', 'Sehr gut!']

interface ProgressiveFieldProps {
  fieldLabel: string
  fieldValue: string
  onChange: (value: string) => void
  fieldIndex: number
  totalFields: number
  onNext: () => void
  onPrevious: () => void
  helpContent: string
  helpTitle: string
  placeholder: string
  inputType?: 'text' | 'tel' | 'date' | 'textarea'
  icon: React.ReactNode
  isLastField: boolean
  isSaved: boolean
  inputId: string
}

export function ProgressiveField({
  fieldLabel,
  fieldValue,
  onChange,
  fieldIndex,
  totalFields,
  onNext,
  onPrevious,
  helpContent,
  helpTitle,
  placeholder,
  inputType = 'text',
  icon,
  isLastField,
  isSaved,
  inputId,
}: ProgressiveFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [encouragement] = useState(
    () => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
  )

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      if (inputType === 'textarea') {
        textareaRef.current?.focus()
      } else {
        inputRef.current?.focus()
      }
    })
    return () => cancelAnimationFrame(timer)
  }, [fieldIndex, inputType])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && inputType !== 'textarea') {
      e.preventDefault()
      onNext()
    }
  }

  const progressPercent = ((fieldIndex + 1) / totalFields) * 100

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Field progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-base font-medium text-sage-600">
            Feld {fieldIndex + 1} von {totalFields}
          </span>
          {/* Saved indicator */}
          <div
            className={`flex items-center gap-1.5 transition-opacity duration-500 ${
              isSaved ? 'opacity-100' : 'opacity-0'
            }`}
            aria-live="polite"
          >
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-base font-medium text-green-600">
              Gespeichert
            </span>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Encouragement message after save */}
      <div
        className={`text-center transition-all duration-500 ${
          isSaved ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        aria-live="polite"
      >
        <span className="text-lg font-medium text-sage-700">{encouragement}</span>
      </div>

      {/* Field */}
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          <Label htmlFor={inputId} className="mb-0 text-xl font-semibold text-warmgray-900 leading-relaxed">
            {fieldLabel}
          </Label>
          <HelpTooltip title={helpTitle} content={helpContent} />
        </div>

        {inputType === 'textarea' ? (
          <div className="relative">
            <div className="absolute left-5 top-4 text-warmgray-700">
              {icon}
            </div>
            <textarea
              ref={textareaRef}
              id={inputId}
              value={fieldValue}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full min-h-[120px] rounded-md border-2 border-warmgray-400 bg-white pl-14 pr-5 py-4 text-lg text-gray-900 transition-colors placeholder:text-warmgray-600 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-[3px] focus-visible:ring-sage-100 focus-visible:ring-offset-4"
            />
          </div>
        ) : inputType === 'date' ? (
          <Input
            ref={inputRef}
            id={inputId}
            type="date"
            value={fieldValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="cursor-pointer h-14 px-5 py-4 text-lg"
          />
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-warmgray-700">
              {icon}
            </div>
            <Input
              ref={inputRef}
              id={inputId}
              type={inputType}
              value={fieldValue}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="h-14 py-4 pl-14 pr-5 text-lg"
            />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        {fieldIndex > 0 ? (
          <Button
            variant="ghost"
            onClick={onPrevious}
            size="onboarding"
            className="text-warmgray-700"
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Zurück
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={onNext}
          size="onboarding"
          className="min-w-[180px]"
        >
          {isLastField ? 'Abschließen' : 'Nächstes Feld'}
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}
