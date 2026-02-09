"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface TagInputProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

const TagInput = React.forwardRef<HTMLDivElement, TagInputProps>(
  ({ className, value, onChange, placeholder, ...props }, ref) => {
    const [inputValue, setInputValue] = React.useState<string>("")

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        const trimmedValue = inputValue.trim()
        if (trimmedValue && !value.includes(trimmedValue)) {
          onChange([...value, trimmedValue])
        }
        setInputValue("")
      }
    }

    const removeTag = (indexToRemove: number) => {
      onChange(value.filter((_, index) => index !== indexToRemove))
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-14 w-full rounded-md border-2 border-warmgray-400 bg-white px-3 py-2 transition-colors focus-within:border-sage-500 focus-within:ring-[3px] focus-within:ring-sage-100",
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
            placeholder={value.length === 0 ? placeholder : undefined}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-lg text-gray-900 placeholder:text-warmgray-600"
          />
        </div>
      </div>
    )
  }
)
TagInput.displayName = "TagInput"

export { TagInput }
