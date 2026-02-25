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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Loader2, Lock } from 'lucide-react'
import { useVault } from '@/lib/vault/VaultContext'
import { unwrapKey, wrapKey } from '@/lib/security/document-e2ee'
import { createClient } from '@/lib/supabase/client'

interface BulkShareDialogProps {
  documents: Array<{ id: string; title: string; wrapped_dek: string | null }>
  trustedPersons: Array<{ id: string; name: string; linked_user_id: string | null }>
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onRequestVaultUnlock: () => void
}

export function BulkShareDialog({
  documents,
  trustedPersons,
  isOpen,
  onClose,
  onSuccess,
  onRequestVaultUnlock,
}: BulkShareDialogProps) {
  const { isUnlocked, masterKey } = useVault()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [permission, setPermission] = useState<'view' | 'download'>('view')
  const [duration, setDuration] = useState<'7' | '30' | '90' | 'none'>('7')
  const [isSharing, setIsSharing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createClient()

  const registeredPersons = trustedPersons.filter(tp => tp.linked_user_id !== null)

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [supabase])

  const toggleDoc = (id: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedDocIds(new Set(filteredDocuments.map(d => d.id)))
  }

  const selectNone = () => {
    setSelectedDocIds(new Set())
  }

  const handleBulkShare = async () => {
    if (!isUnlocked || !masterKey || !selectedPersonId || !currentUserId) return
    setIsSharing(true)
    setError(null)
    setProgress(0)

    let count = 0
    const errors: string[] = []

    const { data: rkData, error: rkError } = await supabase
      .from('document_relationship_keys')
      .select('wrapped_rk')
      .eq('owner_id', currentUserId)
      .eq('trusted_person_id', selectedPersonId)
      .single()

    if (rkError || !rkData?.wrapped_rk) {
      setError('Beziehungsschlüssel nicht gefunden')
      setIsSharing(false)
      return
    }

    let rk: CryptoKey
    try {
      rk = await unwrapKey(rkData.wrapped_rk, masterKey, 'AES-KW')
    } catch {
      setError('Fehler beim Entschlüsseln des Beziehungsschlüssels')
      setIsSharing(false)
      return
    }

    const expires_at =
      duration !== 'none'
        ? new Date(Date.now() + parseInt(duration) * 86400000).toISOString()
        : null

    for (const docId of selectedDocIds) {
      try {
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('wrapped_dek')
          .eq('id', docId)
          .single()

        if (docError || !docData?.wrapped_dek) {
          errors.push(docId)
          continue
        }

        const dek = await unwrapKey(docData.wrapped_dek, masterKey, 'AES-GCM')
        const wrapped_dek_for_tp = await wrapKey(dek, rk)

        const res = await fetch('/api/documents/share-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: docId,
            trustedPersonId: selectedPersonId,
            wrapped_dek_for_tp,
            expires_at,
            permission,
          }),
        })

        if (!res.ok) {
          errors.push(docId)
          continue
        }

        count++
        setProgress(count)
      } catch {
        errors.push(docId)
      }
    }

    setIsSharing(false)
    setSuccessCount(count)
    onSuccess()
  }

  const durationLabels: Record<string, string> = {
    '7': '7 Tage',
    '30': '30 Tage',
    '90': '90 Tage',
    none: 'Kein Ablaufdatum',
  }

  const handleClose = () => {
    setStep(1)
    setSelectedDocIds(new Set())
    setSearchQuery('')
    setSelectedPersonId('')
    setPermission('view')
    setDuration('7')
    setProgress(0)
    setError(null)
    setSuccessCount(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokumente teilen</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Wählen Sie die Dokumente aus, die Sie teilen möchten.'
              : 'Wählen Sie den Empfänger und die Einstellungen.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            <Input
              placeholder="Dokumente suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="flex gap-3 text-sm">
              <button
                type="button"
                onClick={selectAll}
                className="text-sage-600 hover:underline"
              >
                Alle auswählen
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-warmgray-500 hover:underline"
              >
                Keine
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
              {filteredDocuments.length === 0 ? (
                <p className="text-sm text-warmgray-500 text-center py-4">Keine Dokumente gefunden</p>
              ) : (
                filteredDocuments.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-warmgray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocIds.has(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="rounded"
                    />
                    <span className="text-sm truncate">{doc.title}</span>
                  </label>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={selectedDocIds.size === 0}
              >
                Weiter →
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-recipient">Empfänger</Label>
              {registeredPersons.length === 0 ? (
                <p className="text-sm text-warmgray-500">Keine registrierten Vertrauenspersonen vorhanden</p>
              ) : (
                <select
                  id="bulk-recipient"
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

            {isSharing && selectedDocIds.size > 0 && (
              <div className="space-y-1">
                <Progress value={(progress / selectedDocIds.size) * 100} />
                <p className="text-xs text-warmgray-500 text-center">
                  {progress} / {selectedDocIds.size} Dokumente
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            {successCount !== null && (
              <p className="text-sm font-medium text-green-600">
                {successCount} {successCount === 1 ? 'Dokument' : 'Dokumente'} geteilt
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSharing}>
                ← Zurück
              </Button>
              <Button
                onClick={handleBulkShare}
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
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
