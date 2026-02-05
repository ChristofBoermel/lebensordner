'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface ExpandableHelpProps {
  title: string
  children: React.ReactNode
}

export function ExpandableHelp({ title, children }: ExpandableHelpProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-lg border-2 border-warmgray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 text-left flex items-center justify-between gap-3 hover:bg-sage-50 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-medium text-sage-700">{title}</span>
        <ChevronDown
          className={`w-5 h-5 text-sage-600 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
        role="region"
      >
        <div className="px-5 pb-4 text-lg text-warmgray-800 leading-relaxed bg-sage-50">
          {children}
        </div>
      </div>
    </div>
  )
}
