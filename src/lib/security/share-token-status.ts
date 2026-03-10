export interface ShareTokenStatusRow {
  expires_at: string | null
  revoked_at?: string | null
}

export function isActiveShareToken(
  token: ShareTokenStatusRow,
  nowMs: number = Date.now()
): boolean {
  if (token.revoked_at) {
    return false
  }

  if (!token.expires_at) {
    return true
  }

  const expiresAtMs = new Date(token.expires_at).getTime()
  if (!Number.isFinite(expiresAtMs)) {
    return false
  }

  return expiresAtMs > nowMs
}
