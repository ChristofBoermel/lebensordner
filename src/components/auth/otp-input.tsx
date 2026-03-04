'use client'

import { useRef } from 'react'

interface OTPInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function OTPInput({ value, onChange, disabled }: OTPInputProps) {
  // allowed: imperative-sync - manage keyboard focus across digit inputs
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  function handleChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    if (!char) return
    const newValue = (value.slice(0, index) + char + value.slice(index + 1)).slice(0, 6)
    onChange(newValue)
    if (index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1))
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index))
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    const nextIndex = Math.min(pasted.length, 5)
    inputRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {cells.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={digit}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={i === 0}
          className="w-11 h-14 text-center text-xl font-mono font-semibold border-2 rounded-lg border-warmgray-300 bg-white focus:border-sage-500 focus:outline-none focus:ring-2 focus:ring-sage-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={`Ziffer ${i + 1}`}
        />
      ))}
    </div>
  )
}
