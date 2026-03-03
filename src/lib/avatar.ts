export function extractAvatarStoragePath(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, '')
  }

  try {
    const url = new URL(trimmed)
    const markerMatch = url.pathname.match(/\/object\/(?:public|sign)\/avatars\/(.+)$/)
    if (!markerMatch?.[1]) return null
    return decodeURIComponent(markerMatch[1]).replace(/^\/+/, '')
  } catch {
    return null
  }
}

export async function resolveAvatarUrl(
  _supabase: any,
  value?: string | null,
  _expiresInSeconds = 3600
): Promise<string | null> {
  if (!value) return null

  const path = extractAvatarStoragePath(value)
  if (!path) {
    return value
  }

  return `/api/profile/avatar?v=${encodeURIComponent(path)}`
}
