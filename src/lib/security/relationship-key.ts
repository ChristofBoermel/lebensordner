import {
  generateRelationshipKey,
  importRawHexKey,
  unwrapKey,
  wrapKey,
} from '@/lib/security/document-e2ee'

export async function loadOrCreateRelationshipKey(params: {
  supabase: any
  ownerId: string
  trustedPersonId: string
  masterKey: CryptoKey
}): Promise<CryptoKey> {
  const material = await loadOrCreateRelationshipKeyMaterial(params)
  return material.key
}

export async function loadOrCreateRelationshipKeyMaterial(params: {
  supabase: any
  ownerId: string
  trustedPersonId: string
  masterKey: CryptoKey
}): Promise<{ hex: string; key: CryptoKey }> {
  const { supabase, ownerId, trustedPersonId, masterKey } = params

  const { data: existingKey, error: existingKeyError } = await supabase
    .from('document_relationship_keys')
    .select('wrapped_rk')
    .eq('owner_id', ownerId)
    .eq('trusted_person_id', trustedPersonId)
    .maybeSingle()

  if (existingKeyError) {
    throw new Error('Beziehungsschlüssel konnte nicht geladen werden')
  }

  if (existingKey?.wrapped_rk) {
    const key = await unwrapKey(existingKey.wrapped_rk, masterKey, 'AES-KW')
    return {
      hex: await generateRelationshipKeyExport(key),
      key,
    }
  }

  const relationshipKey = await generateRelationshipKey()
  const relationshipCryptoKey = await importRawHexKey(relationshipKey, ['wrapKey', 'unwrapKey'])
  const wrappedRelationshipKey = await wrapKey(relationshipCryptoKey, masterKey)

  const response = await fetch('/api/trusted-person/relationship-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trustedPersonId,
      wrapped_rk: wrappedRelationshipKey,
    }),
  })

  if (!response.ok) {
    throw new Error('Beziehungsschlüssel konnte nicht erstellt werden')
  }

  return {
    hex: relationshipKey,
    key: relationshipCryptoKey,
  }
}

async function generateRelationshipKeyExport(key: CryptoKey): Promise<string> {
  if (typeof key !== 'object' || key === null) {
    return String(key)
  }

  if (typeof globalThis.CryptoKey !== 'undefined' && !(key instanceof globalThis.CryptoKey)) {
    return String(key)
  }

  const raw = await crypto.subtle.exportKey('raw', key)
  return Array.from(new Uint8Array(raw))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
