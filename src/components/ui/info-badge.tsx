import { Crown, Eye, Lock, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoBadgeProps {
  type: 'premium' | 'basic' | 'free'
  variant?: 'default' | 'compact'
  className?: string
}

export function InfoBadge({ type, variant = 'default', className }: InfoBadgeProps) {
  const config = {
    premium: {
      icon: Download,
      text: 'Voller Zugriff',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    },
    basic: {
      icon: Eye,
      text: 'Nur Ansicht',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
    },
    free: {
      icon: Lock,
      text: 'Kein Zugriff',
      bgColor: 'bg-warmgray-100',
      textColor: 'text-warmgray-600',
      borderColor: 'border-warmgray-200',
    },
  }

  const { icon: Icon, text, bgColor, textColor, borderColor } = config[type]

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
          bgColor,
          textColor,
          borderColor,
          className
        )}
      >
        <Icon className="w-3 h-3" />
        {text}
      </span>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border',
        bgColor,
        textColor,
        borderColor,
        className
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}

interface TierStatusCardProps {
  tier: 'premium' | 'basic' | 'free'
  className?: string
}

export function TierStatusCard({ tier, className }: TierStatusCardProps) {
  const config = {
    premium: {
      icon: Crown,
      title: 'Premium',
      description: 'Ihre Vertrauenspersonen können Dokumente ansehen und herunterladen',
      bgColor: 'bg-green-50',
      iconBgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      textColor: 'text-green-800',
      borderColor: 'border-green-200',
    },
    basic: {
      icon: Eye,
      title: 'Basis',
      description: 'Ihre Vertrauenspersonen können Dokumente nur ansehen (ohne Download)',
      bgColor: 'bg-blue-50',
      iconBgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-200',
    },
    free: {
      icon: Lock,
      title: 'Kostenlos',
      description: 'Vertrauenspersonen-Funktion erfordert ein kostenpflichtiges Abo',
      bgColor: 'bg-warmgray-50',
      iconBgColor: 'bg-warmgray-100',
      iconColor: 'text-warmgray-600',
      textColor: 'text-warmgray-700',
      borderColor: 'border-warmgray-200',
    },
  }

  const { icon: Icon, title, description, bgColor, iconBgColor, iconColor, textColor, borderColor } = config[tier]

  return (
    <div className={cn('rounded-lg border p-4', bgColor, borderColor, className)}>
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', iconBgColor)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('font-semibold', textColor)}>{title}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', iconBgColor, iconColor)}>
              Ihr Abo
            </span>
          </div>
          <p className={cn('text-sm mt-1', textColor, 'opacity-90')}>{description}</p>
        </div>
      </div>
    </div>
  )
}
