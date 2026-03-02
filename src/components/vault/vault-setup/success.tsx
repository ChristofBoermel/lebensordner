'use client'

import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVaultSetupContext } from './context'

export function VaultSetupSuccess() {
  const { onClose } = useVaultSetupContext()

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4 animate-in fade-in zoom-in duration-500">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center animate-bounce">
          <ShieldCheck className="w-12 h-12 text-emerald-600" />
        </div>
        <div className="absolute -top-2 -right-2">
          <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-serif font-bold text-warmgray-900">
          Sicherheits-Meilenstein erreicht!
        </h3>
        <p className="text-warmgray-600 text-lg max-w-md">
          Ihr digitaler Tresor ist nun mit Ihrer persönlichen Passphrase verschlüsselt. 
          Nur Sie besitzen den Schlüssel zu Ihren Dokumenten.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 w-full pt-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-left">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Ende-zu-Ende Verschlüsselung aktiv
          </p>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-left">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Wiederherstellungsschlüssel generiert
          </p>
        </div>
      </div>

      <Button 
        onClick={onClose} 
        size="lg" 
        className="w-full h-14 text-lg senior-mode:h-16 senior-mode:text-xl shadow-lg mt-4"
      >
        Einrichtung abschließen
      </Button>
    </div>
  )
}
