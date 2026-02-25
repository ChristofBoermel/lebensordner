'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Share2, Lock } from 'lucide-react'
import { useVault } from '@/lib/vault/VaultContext'
import { unwrapKey, wrapKey } from '@/lib/security/document-e2ee'
import { createClient } from '@/lib/supabase/client'

interface ShareDocumentDialogProps {
  document: { id: string; title: string; wrapped_dek: string | null }
  trustedPersons: Array<{ id: string; name: string; linked_user_id: string | null }>
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onRequestVaultUnlock: () => void
}

export function ShareDocumentDialog({
  document,
  trustedPersons,
  isOpen,
  onClose,
  onSuccess,
  onRequestVaultUnlock,
}: ShareDocumentDialogProps) {
  const { isUnlocked, masterKey } = useVault()
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [permission, setPermission] = useState<'view' | 'download'>('view')
  const [duration, setDuration] = useState<'7' | '30' | '90' | 'none'>('7')
  const [isSharing, setIsSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createClient()

  const registeredPersons = trustedPersons.filter(tp => tp.linked_user_id !== null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [supabase])

  const handleShare = async () => {
    if (!isUnlocked || !masterKey || !selectedPersonId || !currentUserId) return
    setIsSharing(true)
    setError(null)

    try {
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('wrapped_dek')
        .eq('id', document.id)
        .single()

      if (docError || !docData?.wrapped_dek) {
        throw new Error('Dokument-Schlüssel nicht gefunden')
      }

      const dek = await unwrapKey(docData.wrapped_dek, masterKey, 'AES-GCM')

      const { data: rkData, error: rkError } = await supabase
        .from('document_relationship_keys')
        .select('wrapped_rk')
        .eq('owner_id', currentUserId)
        .eq('trusted_person_id', selectedPersonId)
        .single()

      if (rkError || !rkData?.wrapped_rk) {
        throw new Error('Beziehungsschlüssel nicht gefunden')
      }

      const rk = await unwrapKey(rkData.wrapped_rk, masterKey, 'AES-KW')
      const wrapped_dek_for_tp = await wrapKey(dek, rk)

      const expires_at =
        duration !== 'none'
          ? new Date(Date.now() + parseInt(duration) * 86400000).toISOString()
          : null

      const res = await fetch('/api/documents/share-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          trustedPersonId: selectedPersonId,
          wrapped_dek_for_tp,
          expires_at,
          permission,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Fehler beim Teilen')
      }

      setSuccess(true)
      onSuccess()
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setIsSharing(false)
    }
  }

  const durationLabels: Record<string, string> = {
    '7': '7 Tage',
    '30': '30 Tage',
    '90': '90 Tage',
    none: 'Kein Ablaufdatum',
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-sage-600" />
            Dokument teilen
          </DialogTitle>
          <DialogDescription>
            Teilen Sie „{document.title}" mit einer Vertrauensperson.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Empfänger</Label>
            {registeredPersons.length === 0 ? (
              <p className="text-sm text-warmgray-500">Keine registrierten Vertrauenspersonen vorhanden</p>
            ) : (
              <select
                id="recipient"
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Person auswählen...</option>
                {registeredPersons.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Berechtigung</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPermission('view')}
                className={permission === 'view' ? 'bg-sage-100 border-sage-400' : ''}
              >
                Nur ansehen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPermission('download')}
                className={permission === 'download' ? 'bg-sage-100 border-sage-400' : ''}
              >
                Herunterladen erlaubt
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gültigkeitsdauer</Label>
            <div className="flex flex-wrap gap-2">
              {(['7', '30', '90', 'none'] as const).map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDuration(d)}
                  className={duration === d ? 'bg-sage-100 border-sage-400' : ''}
                >
                  {durationLabels[d]}
                </Button>
              ))}
            </div>
          </div>

          {!isUnlocked && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-800">
                  Tresor muss entsperrt sein, um Dokumente zu teilen
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRequestVaultUnlock}
                className="flex-shrink-0"
              >
                Tresor entsperren
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          {success ? (
            <p className="text-sm font-medium text-green-600">Erfolgreich geteilt!</p>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
              <Button
                onClick={handleShare}
                disabled={!selectedPersonId || !isUnlocked || isSharing}
              >
                {isSharing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Teilen...
                  </>
                ) : (
                  'Teilen'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
