'use client'

import { createContext, use, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react'
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
import { loadOrCreateRelationshipKey } from '@/lib/security/relationship-key'
import { createClient } from '@/lib/supabase/client'

interface BulkShareDialogProps {
  documents: Array<{ id: string; title: string; wrapped_dek: string | null }>
  trustedPersons: Array<{ id: string; name: string; linked_user_id: string | null }>
  userId: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type BulkShareContextValue = {
  step: 1 | 2
  setStep: (step: 1 | 2) => void
  selectedDocIds: Set<string>
  setSelectedDocIds: Dispatch<SetStateAction<Set<string>>>
  searchQuery: string
  setSearchQuery: (value: string) => void
  selectedPersonId: string
  setSelectedPersonId: (value: string) => void
  permission: 'view' | 'download'
  setPermission: (value: 'view' | 'download') => void
  duration: '7' | '30' | '90' | 'none'
  setDuration: (value: '7' | '30' | '90' | 'none') => void
  isSharing: boolean
  progress: number
  error: string | null
  successCount: number | null
  handleBulkShare: () => Promise<void>
  hasUserId: boolean
  registeredPersons: Array<{ id: string; name: string; linked_user_id: string | null }>
  filteredDocuments: Array<{ id: string; title: string; wrapped_dek: string | null }>
  onClose: () => void
}

const BulkShareContext = createContext<BulkShareContextValue | null>(null)

function useBulkShareContext() {
  const context = use(BulkShareContext)
  if (!context) {
    throw new Error('BulkShare components must be used within BulkShareDialog')
  }
  return context
}

function BulkShareDocumentPicker() {
  const {
    filteredDocuments,
    searchQuery,
    setSearchQuery,
    selectedDocIds,
    setSelectedDocIds,
    setStep,
    onClose
  } = useBulkShareContext()

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

  return (
    <div className="space-y-3">
      <Input
        placeholder="Dokumente suchen..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      <div className="flex gap-3 text-sm">
        <button type="button" onClick={selectAll} className="text-sage-600 hover:underline">
          Alle auswahlen
        </button>
        <button type="button" onClick={selectNone} className="text-warmgray-500 hover:underline">
          Keine
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
        {filteredDocuments.length === 0 ? (
          <p className="text-sm text-warmgray-500 text-center py-4">Keine Dokumente gefunden</p>
        ) : (
          filteredDocuments.map(doc => (
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
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={() => setStep(2)} disabled={selectedDocIds.size === 0}>
          Weiter →
        </Button>
      </DialogFooter>
    </div>
  )
}

function BulkShareSettings() {
  const vault = useVault()
  const {
    setStep,
    registeredPersons,
    selectedPersonId,
    setSelectedPersonId,
    permission,
    setPermission,
    duration,
    setDuration,
    isSharing,
    hasUserId,
    selectedDocIds,
    progress,
    error,
    successCount,
    handleBulkShare
  } = useBulkShareContext()
  const { isUnlocked } = vault

  const durationLabels: Record<string, string> = {
    '7': '7 Tage',
    '30': '30 Tage',
    '90': '90 Tage',
    none: 'Kein Ablaufdatum'
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bulk-recipient">Empfanger</Label>
        {registeredPersons.length === 0 ? (
          <p className="text-sm text-warmgray-500">Keine registrierten Vertrauenspersonen vorhanden</p>
        ) : (
          <select
            id="bulk-recipient"
            value={selectedPersonId}
            onChange={e => setSelectedPersonId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Person auswahlen...</option>
            {registeredPersons.map(tp => (
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
        <Label>Gultigkeitsdauer</Label>
        <div className="flex flex-wrap gap-2">
          {(['7', '30', '90', 'none'] as const).map(d => (
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
            <p className="text-sm text-amber-800">Tresor muss entsperrt sein, um Dokumente zu teilen</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => vault.requestUnlock()}
            className="flex-shrink-0"
          >
            Tresor entsperren
          </Button>
        </div>
      )}

      {!hasUserId && (
        <p className="text-sm text-amber-700">
          Benutzer-ID wird geladen. Teilen ist gleich verfügbar.
        </p>
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
          ← Zuruck
        </Button>
        <Button onClick={handleBulkShare} disabled={!selectedPersonId || !isUnlocked || !hasUserId || isSharing}>
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
  )
}

type BulkShareDialogComponent = ((props: BulkShareDialogProps) => ReactElement) & {
  DocumentPicker: typeof BulkShareDocumentPicker
  Settings: typeof BulkShareSettings
}

export const BulkShareDialog: BulkShareDialogComponent = function BulkShareDialog({
  documents,
  trustedPersons,
  userId,
  isOpen,
  onClose,
  onSuccess
}: BulkShareDialogProps) {
  const { isUnlocked, masterKey } = useVault()
  const hasUserId = Boolean(userId)
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

  const supabase = createClient()

  const registeredPersons = trustedPersons.filter(tp => tp.linked_user_id !== null)

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleBulkShare = async () => {
    if (!userId) {
      setError('Ihr Benutzerkonto wird noch geladen. Bitte versuchen Sie es gleich erneut.')
      return
    }
    if (!isUnlocked || !masterKey || !selectedPersonId) return
    setIsSharing(true)
    setError(null)
    setProgress(0)

    let count = 0
    const errors: string[] = []

    try {
      const rk = await loadOrCreateRelationshipKey({
        supabase,
        ownerId: userId,
        trustedPersonId: selectedPersonId,
        masterKey,
      })

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
    } catch {
      setError('Beziehungsschlüssel konnte nicht vorbereitet werden')
      setIsSharing(false)
      return
    }

    setIsSharing(false)
    setSuccessCount(count)
    onSuccess()
  }

  const contextValue: BulkShareContextValue = {
    step,
    setStep,
    selectedDocIds,
    setSelectedDocIds,
    searchQuery,
    setSearchQuery,
    selectedPersonId,
    setSelectedPersonId,
    permission,
    setPermission,
    duration,
    setDuration,
    isSharing,
    hasUserId,
    progress,
    error,
    successCount,
    handleBulkShare,
    registeredPersons,
    filteredDocuments,
    onClose
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokumente teilen</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Wählen Sie die Dokumente aus, die Sie teilen möchten.'
              : 'Wählen Sie den Empfänger und die Einstellungen.'}
          </DialogDescription>
        </DialogHeader>

        <BulkShareContext.Provider value={contextValue}>
          {step === 1 ? <BulkShareDialog.DocumentPicker /> : <BulkShareDialog.Settings />}
        </BulkShareContext.Provider>
      </DialogContent>
    </Dialog>
  )
}

BulkShareDialog.DocumentPicker = BulkShareDocumentPicker
BulkShareDialog.Settings = BulkShareSettings
