"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface TagInputProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  ref?: React.Ref<HTMLDivElement>
}

function TagInput({ className, value, onChange, placeholder, suggestions = [], ref, ...props }: TagInputProps) {
  const [inputValue, setInputValue] = React.useState<string>("")
  const [showSuggestions, setShowSuggestions] = React.useState(false)

  const filteredSuggestions = suggestions
    .filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(s))
    .slice(0, 6)

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue("")
  }

  function removeTag(indexToRemove: number) {
    onChange(value.filter((_, index) => index !== indexToRemove))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (inputValue.trim()) addTag(inputValue)
    } else if (e.key === ",") {
      e.preventDefault()
      if (inputValue.trim()) addTag(inputValue)
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex min-h-14 w-full rounded-md border-2 border-warmgray-400 bg-white px-3 py-2 transition-colors focus-within:border-sage-500 focus-within:ring-[3px] focus-within:ring-sage-100",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-2 w-full">
        {value.map((tag, index) => (
          <div
            key={index}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-warmgray-100 text-warmgray-800 text-base"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:bg-warmgray-200 rounded-sm transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-lg text-gray-900 placeholder:text-warmgray-600"
        />
      </div>

      {showSuggestions && inputValue.trim() && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-warmgray-200 bg-white shadow-lg">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                addTag(suggestion)
              }}
              className="w-full px-3 py-2 text-left text-sm text-warmgray-800 hover:bg-sage-50 transition-colors first:rounded-t-md last:rounded-b-md"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
TagInput.displayName = "TagInput"

export { TagInput }
