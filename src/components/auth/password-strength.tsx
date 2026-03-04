'use client'

interface PasswordStrengthProps {
  password: string
}

function getStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return 1
  if (score <= 2) return 2
  return 3
}

const LABELS = ['', 'Schwach', 'Mittel', 'Stark'] as const
const COLORS = ['', 'bg-red-500', 'bg-amber-400', 'bg-sage-500'] as const
const TEXT_COLORS = ['', 'text-red-600', 'text-amber-600', 'text-sage-600'] as const

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null

  const strength = getStrength(password)

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {([1, 2, 3] as const).map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              level <= strength ? COLORS[strength] : 'bg-warmgray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${TEXT_COLORS[strength]}`}>
        {LABELS[strength]}
      </p>
    </div>
  )
}
