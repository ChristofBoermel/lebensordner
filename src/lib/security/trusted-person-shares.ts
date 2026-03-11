import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from '@/lib/security/share-token-compat'

export interface ActiveShareTokenRow {
  document_id: string
  wrapped_dek_for_tp: string
  expires_at: string | null
  permission?: string
  revoked_at?: string | null
}

function isTokenActive(expiresAt: string | null, nowMs: number): boolean {
  if (!expiresAt) return true
  const expiresAtMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresAtMs)) return false
  return expiresAtMs > nowMs
}

export async function getActiveTrustedPersonShareTokens(
  adminClient: any,
  ownerId: string,
  trustedPersonId: string
): Promise<{
  tokens: ActiveShareTokenRow[]
  tokenMap: Record<string, string>
  documentIds: string[]
}> {
  let { data: shareTokens, error } = await adminClient
    .from('document_share_tokens')
    .select('document_id, wrapped_dek_for_tp, expires_at')
    .eq('owner_id', ownerId)
    .eq('trusted_person_id', trustedPersonId)
    .is('revoked_at', null)

  if (isLegacyShareTokenSchemaError(error)) {
    ;({ data: shareTokens, error } = await adminClient
      .from('document_share_tokens')
      .select('document_id, wrapped_dek_for_tp')
      .eq('owner_id', ownerId)
      .eq('trusted_person_id', trustedPersonId))
  }

  if (error) {
    throw new Error(`Error fetching share tokens: ${error.message}`)
  }

  const nowMs = Date.now()
  const activeTokens: ActiveShareTokenRow[] = ((shareTokens || []) as ActiveShareTokenRow[])
    .map((token) => withLegacyShareTokenDefaults(token))
    .filter((token) => isTokenActive(token.expires_at, nowMs))

  const tokenMap: Record<string, string> = {}
  for (const token of activeTokens) {
    tokenMap[token.document_id] = token.wrapped_dek_for_tp
  }

  const documentIds: string[] = [...new Set(activeTokens.map((token) => token.document_id))]

  return {
    tokens: activeTokens,
    tokenMap,
    documentIds,
  }
}
