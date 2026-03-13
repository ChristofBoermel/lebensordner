const firstHeaderToken = (value: string | null) => value?.split(',')[0]?.trim() ?? null

export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

export function resolvePublicOrigin(request: Request): string {
  const forwardedHost = firstHeaderToken(request.headers.get('x-forwarded-host'))
  const host = forwardedHost ?? firstHeaderToken(request.headers.get('host'))
  const forwardedProto = firstHeaderToken(request.headers.get('x-forwarded-proto'))
  const proto = forwardedProto ?? (host?.includes('localhost') ? 'http' : 'https')

  if (host) {
    const headerOrigin = normalizeOrigin(`${proto}://${host}`)
    if (headerOrigin) {
      return headerOrigin
    }
  }

  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.SITE_URL) ??
    normalizeOrigin(new URL(request.url).origin) ??
    'http://localhost:3000'
  )
}
