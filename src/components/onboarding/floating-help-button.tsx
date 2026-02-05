'use client'

import { HelpCircle, X } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useState } from 'react'

type Step = 'welcome' | 'profile' | 'documents' | 'emergency' | 'complete'

interface FloatingHelpButtonProps {
  currentStep: Step
}

const STEP_HELP: Record<Step, { title: string; content: string }> = {
  welcome: {
    title: 'Willkommen',
    content:
      'Willkommen! Nehmen Sie sich Zeit f\u00fcr die Einrichtung. Sie k\u00f6nnen jederzeit pausieren und sp\u00e4ter weitermachen. Alle Ihre Daten werden sicher verschl\u00fcsselt.',
  },
  profile: {
    title: 'Ihr Profil',
    content:
      'F\u00fcllen Sie die Felder in Ruhe aus. Alle Angaben sind optional. Klicken Sie auf die Fragezeichen (?) neben jedem Feld f\u00fcr mehr Informationen.',
  },
  documents: {
    title: 'Ihre Dokumente',
    content:
      'Hier sehen Sie, welche Dokumente Sie sp\u00e4ter hochladen k\u00f6nnen. Sie m\u00fcssen jetzt noch nichts hochladen \u2013 das kommt nach der Einrichtung.',
  },
  emergency: {
    title: 'Notfall-Kontakt',
    content:
      'Ihr Notfallkontakt erh\u00e4lt nur dann Zugriff, wenn Sie dies ausdr\u00fccklich erlauben. Sie haben volle Kontrolle \u00fcber die Zugriffsrechte.',
  },
  complete: {
    title: 'Fertig!',
    content:
      'Geschafft! Sie k\u00f6nnen jetzt Dokumente hochladen oder sp\u00e4ter weitermachen. Ihre Einrichtung ist gespeichert.',
  },
}

export function FloatingHelpButton({ currentStep }: FloatingHelpButtonProps) {
  const [open, setOpen] = useState(false)
  const help = STEP_HELP[currentStep]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-sage-600 hover:bg-sage-700 text-white shadow-lg transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-4"
        aria-label="Hilfe anzeigen"
      >
        <HelpCircle className="w-8 h-8" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md relative [&>button]:hidden">
          <div className="absolute right-4 top-4">
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Schließen"
                className="rounded-md p-1 text-warmgray-600 transition-colors hover:text-warmgray-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sage-500 focus-visible:ring-offset-2"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">
              {help.title}
            </DialogTitle>
            <DialogDescription className="text-lg text-warmgray-800 leading-relaxed pt-2">
              {help.content}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2 text-base text-warmgray-600">
            Dr\u00fccken Sie <kbd className="px-2 py-0.5 bg-warmgray-100 rounded text-sm font-mono">Esc</kbd> zum Schlie\u00dfen oder klicken Sie auf das X.
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
