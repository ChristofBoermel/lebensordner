export interface ShareTokenSchemaErrorLike {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

const LEGACY_SHARE_TOKEN_COLUMNS = ['expires_at', 'permission', 'revoked_at']

export function isLegacyShareTokenSchemaError(error: ShareTokenSchemaErrorLike | null | undefined): boolean {
  if (!error) {
    return false
  }

  if (error.code === '42703') {
    return true
  }

  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return LEGACY_SHARE_TOKEN_COLUMNS.some((column) => message.includes(column))
}

export function withLegacyShareTokenDefaults<
  T extends Partial<{ expires_at: string | null; permission: string; revoked_at: string | null }>
>(
  row: T
): T & { expires_at: string | null; permission: string; revoked_at: string | null } {
  return {
    ...row,
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : null,
    permission: typeof row.permission === 'string' ? row.permission : 'view',
    revoked_at: typeof row.revoked_at === 'string' ? row.revoked_at : null,
  }
}
