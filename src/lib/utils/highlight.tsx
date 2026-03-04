import type { ReactNode } from 'react'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function highlightText(text: string, query: string): ReactNode {
  if (!query.trim() || !text) return text
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    new RegExp(`(${escapeRegex(query)})`, 'gi').test(part)
      ? <mark key={i} className="bg-sage-100 text-sage-800 rounded-sm px-0.5 font-medium not-italic">{part}</mark>
      : part
  )
}
