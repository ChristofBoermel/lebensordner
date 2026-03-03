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
  supabase: any,
  value?: string | null,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!value) return null

  const path = extractAvatarStoragePath(value)
  if (!path) {
    return value
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    // Avoid reusing stale signed URLs (they cause repeated 401 image fetches).
    // Only keep direct public object URLs as fallback.
    if (/^https?:\/\//i.test(value)) {
      try {
        const parsed = new URL(value)
        if (parsed.pathname.includes('/object/public/avatars/')) {
          return value
        }
      } catch {
        return null
      }
    }
    return null
  }

  return data.signedUrl
}
