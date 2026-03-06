import { createHmac, timingSafeEqual } from 'crypto'

const CHALLENGE_COOKIE_TTL_SECONDS = 30 * 60

type ChallengePayload = {
  tokenHashPrefix: string
  recipientEmail: string
  exp: number
}

function getSigningSecret(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  return createHmac('sha256', 'download-link-recipient-secret').update(base).digest()
}

function signPayload(data: string): string {
  return createHmac('sha256', getSigningSecret()).update(data).digest('hex')
}

export function getRecipientChallengeCookieName(tokenHashPrefix: string): string {
  return `dlv_${tokenHashPrefix}`
}

export function createRecipientChallengeCookieValue(
  tokenHashPrefix: string,
  recipientEmail: string
): string {
  const payload: ChallengePayload = {
    tokenHashPrefix,
    recipientEmail: recipientEmail.toLowerCase().trim(),
    exp: Date.now() + CHALLENGE_COOKIE_TTL_SECONDS * 1000,
  }
  const data = JSON.stringify(payload)
  const signature = signPayload(data)
  return Buffer.from(JSON.stringify({ data, signature })).toString('base64url')
}

export function verifyRecipientChallengeCookieValue(
  rawCookieValue: string | null | undefined,
  tokenHashPrefix: string,
  recipientEmail: string
): boolean {
  if (!rawCookieValue) return false

  try {
    const parsed = JSON.parse(Buffer.from(rawCookieValue, 'base64url').toString('utf8')) as {
      data: string
      signature: string
    }
    const expectedSignature = signPayload(parsed.data)
    const sigBuffer = Buffer.from(parsed.signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (sigBuffer.length !== expectedBuffer.length) return false
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return false

    const payload = JSON.parse(parsed.data) as ChallengePayload
    if (payload.exp < Date.now()) return false
    if (payload.tokenHashPrefix !== tokenHashPrefix) return false
    if (payload.recipientEmail !== recipientEmail.toLowerCase().trim()) return false
    return true
  } catch {
    return false
  }
}

export function buildRecipientChallengeSetCookie(
  tokenHashPrefix: string,
  recipientEmail: string
): string {
  const value = createRecipientChallengeCookieValue(tokenHashPrefix, recipientEmail)
  const name = getRecipientChallengeCookieName(tokenHashPrefix)
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CHALLENGE_COOKIE_TTL_SECONDS}`
}

export function readCookieValueFromHeader(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';').map((part) => part.trim())
  const match = parts.find((part) => part.startsWith(`${cookieName}=`))
  if (!match) return null
  return match.slice(cookieName.length + 1)
}
