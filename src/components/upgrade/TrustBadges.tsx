'use client'

import { Shield, Check } from 'lucide-react'

interface TrustBadgesProps {
  className?: string
  variant?: 'default' | 'compact'
}

export function TrustBadges({ className = '', variant = 'default' }: TrustBadgesProps) {
  const items = [
    '30 Tage kostenlos testen',
    'Geld zurück, wenn Sie nicht zufrieden sind',
    'Jederzeit kündbar, keine Mindestlaufzeit',
  ]

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-4 text-sm text-green-700 ${className}`}>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-green-600" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`rounded-xl border-2 border-green-200 bg-green-50 p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-green-900">
          Risikolos testen
        </h3>
      </div>

      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-lg text-green-800">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
