import { createHash } from 'crypto'

export function hashDownloadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function buildDownloadTokenHashPrefix(token: string): string {
  return hashDownloadToken(token).slice(0, 12)
}
