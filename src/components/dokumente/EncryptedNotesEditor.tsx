'use client'

import { use, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { VaultContext } from '@/lib/vault/VaultContext'
import { createClient } from '@/lib/supabase/client'
import { decryptField, encryptField, unwrapKey } from '@/lib/security/document-e2ee'
import type { Document } from '@/types/database'

interface UnlockedProps {
  doc: Document
  onClose: () => void
  onSaveSuccess?: (savedNote: Pick<Document, 'id' | 'notes_encrypted' | 'notes'>) => void
}

interface LockedProps {
  onClose: () => void
}

function EncryptedNotesEditorLocked({ onClose: _onClose }: LockedProps) {
  const vault = use(VaultContext)
  if (!vault) throw new Error('EncryptedNotesEditor must be used within VaultProvider')

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="rounded-full bg-amber-50 border border-amber-200 w-14 h-14 flex items-center justify-center">
        <Lock className="w-6 h-6 text-amber-600" />
      </div>
      <p className="font-medium text-warmgray-800">
        Tresor entsperren um Notiz anzuzeigen
      </p>
      <p className="text-sm text-warmgray-500">
        Ihre Notizen sind durch den Tresor geschützt.
      </p>
      <Button
        variant="outline"
        onClick={() => vault.requestUnlock()}
        className="border-amber-300 text-amber-700 hover:bg-amber-50"
      >
        Entsperren
      </Button>
    </div>
  )
}

function EncryptedNotesEditorUnlocked({ doc, onClose, onSaveSuccess }: UnlockedProps) {
  const vault = use(VaultContext)
  if (!vault) throw new Error('EncryptedNotesEditor must be used within VaultProvider')

  const [text, setText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dek, setDek] = useState<CryptoKey | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function decryptNote() {
      if (!vault?.masterKey || !doc.wrapped_dek) {
        setIsLoading(false)
        return
      }

      try {
        const unwrapped = await unwrapKey(doc.wrapped_dek, vault.masterKey, 'AES-GCM')
        if (cancelled) return
        setDek(unwrapped)

        if (doc.notes_encrypted) {
          const decrypted = await decryptField(doc.notes_encrypted, unwrapped)
          if (!cancelled) setText(decrypted)
        } else if (doc.notes) {
          // Legacy migration: load plaintext notes as initial content
          if (!cancelled) setText(doc.notes)
        }
      } catch (e) {
        console.error('Failed to decrypt note', e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void decryptNote()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, vault?.masterKey])

  const handleSave = async () => {
    if (!dek) return
    setIsSaving(true)
    try {
      const encrypted = await encryptField(text, dek)
      const { error } = await supabase
        .from('documents')
        .update({ notes_encrypted: encrypted, notes: null })
        .eq('id', doc.id)

      if (error) throw error
      onSaveSuccess?.({ id: doc.id, notes_encrypted: encrypted, notes: null })
      toast({ title: 'Notiz gespeichert' })
      onClose()
    } catch (e) {
      console.error('Failed to save note', e)
      toast({ title: 'Fehler beim Speichern', description: 'Bitte versuche es erneut.' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-warmgray-500">Notiz entschlüsseln...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 overflow-y-auto min-h-0">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Notiz hinzufügen..."
          rows={6}
          className="w-full h-full resize-none rounded-md border border-warmgray-200 bg-white px-3 py-2 text-sm text-warmgray-900 placeholder:text-warmgray-400 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
        />
      </div>
      <div className="flex justify-end gap-2 flex-shrink-0">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Abbrechen
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving || !dek}
        >
          {isSaving ? 'Speichern...' : 'Speichern'}
        </Button>
      </div>
    </div>
  )
}

export const EncryptedNotesEditor = {
  Locked: EncryptedNotesEditorLocked,
  Unlocked: EncryptedNotesEditorUnlocked,
}
