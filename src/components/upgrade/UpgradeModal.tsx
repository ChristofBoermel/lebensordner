'use client'

import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Folder, Users, HardDrive } from 'lucide-react'
import Link from 'next/link'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'

type FeatureType = 'document' | 'folder' | 'trusted_person' | 'storage' | 'custom_category'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: FeatureType
  currentLimit?: number
  basicLimit?: number | string
  premiumLimit?: number | string
}

const featureConfig: Record<FeatureType, {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  emoji: string
}> = {
  document: {
    icon: FileText,
    title: 'Mehr Dokumente speichern?',
    description: 'Sichern Sie alle Ihre wichtigen Unterlagen an einem Ort.',
    emoji: '📄',
  },
  folder: {
    icon: Folder,
    title: 'Mehr Ordnung gewünscht?',
    description: 'Mit mehr Ordnern behalten Sie auch bei vielen Dokumenten den Überblick.',
    emoji: '📂',
  },
  trusted_person: {
    icon: Users,
    title: 'Mehr Vertrauenspersonen hinzufügen?',
    description: 'Geben Sie weiteren Familienangehörigen Zugang zu wichtigen Dokumenten.',
    emoji: '👥',
  },
  storage: {
    icon: HardDrive,
    title: 'Mehr Speicherplatz benötigt?',
    description: 'Laden Sie auch größere Dateien und mehr Dokumente hoch.',
    emoji: '💾',
  },
  custom_category: {
    icon: Folder,
    title: 'Mehr eigene Kategorien erstellen?',
    description: 'Organisieren Sie Ihre Dokumente nach Ihren eigenen Wünschen.',
    emoji: '🏷️',
  },
}

export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  currentLimit,
  basicLimit,
  premiumLimit,
}: UpgradeModalProps) {
  const { capture } = usePostHog()
  const config = featureConfig[feature]
  const Icon = config.icon

  useEffect(() => {
    if (isOpen) {
      capture(ANALYTICS_EVENTS.UPGRADE_MODAL_SHOWN, {
        feature_type: feature,
        current_limit: currentLimit,
      })
    }
  }, [isOpen, feature, currentLimit, capture])

  const handleClose = () => {
    capture(ANALYTICS_EVENTS.UPGRADE_MODAL_DISMISSED, {
      feature_type: feature,
    })
    onClose()
  }

  const handleUpgradeClick = () => {
    capture(ANALYTICS_EVENTS.UPGRADE_MODAL_CLICKED, {
      feature_type: feature,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 text-6xl">
            {config.emoji}
          </div>
          <DialogTitle className="text-2xl font-semibold text-warmgray-900">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-lg text-warmgray-600 mt-2">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Limit info */}
          {currentLimit !== undefined && (
            <div className="text-center text-base text-warmgray-600">
              Sie haben das Limit von <span className="font-semibold">{currentLimit}</span> erreicht.
            </div>
          )}

          {/* Upgrade benefits */}
          <div className="bg-sage-50 rounded-lg p-4 space-y-2">
            {basicLimit && (
              <div className="flex items-center justify-between text-base">
                <span className="text-warmgray-700">Mit Basis:</span>
                <span className="font-semibold text-warmgray-900">
                  {typeof basicLimit === 'number' ? basicLimit : basicLimit}
                </span>
              </div>
            )}
            {premiumLimit && (
              <div className="flex items-center justify-between text-base">
                <span className="text-warmgray-700">Mit Premium:</span>
                <span className="font-semibold text-sage-700">
                  {typeof premiumLimit === 'number' ? premiumLimit : premiumLimit}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Link href="/abo" className="w-full sm:w-auto" onClick={handleUpgradeClick}>
            <Button size="lg" className="w-full text-lg py-6">
              Tarife vergleichen
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={handleClose}
            className="w-full sm:w-auto text-lg py-6"
          >
            Jetzt nicht
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
