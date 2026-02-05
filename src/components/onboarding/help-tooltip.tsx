'use client'

import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface HelpTooltipProps {
  content: string
  title?: string
}

export function HelpTooltip({ content, title }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full text-sage-600 hover:text-sage-700 hover:bg-sage-50 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-2"
            aria-label={title ? `Hilfe: ${title}` : 'Hilfe anzeigen'}
          >
            <HelpCircle className="w-6 h-6" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          className="max-w-[320px] px-4 py-3 bg-warmgray-900 text-white text-base leading-relaxed rounded-lg"
          sideOffset={8}
        >
          {title && (
            <p className="font-semibold mb-1 text-base">{title}</p>
          )}
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
