import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { decrypt, encrypt, getEncryptionKey, type EncryptedData } from '@/lib/security/encryption'

export const TRUSTED_ACCESS_INVITATION_TTL_MINUTES = 15
export const TRUSTED_ACCESS_OTP_TTL_MINUTES = 10
export const TRUSTED_ACCESS_OTP_MAX_ATTEMPTS = 5
export const TRUSTED_ACCESS_PENDING_COOKIE = 'trusted_access_pending'
export const TRUSTED_ACCESS_OTP_COOKIE = 'trusted_access_otp'
export const TRUSTED_ACCESS_DEVICE_COOKIE = 'trusted_access_device'

export type TrustedAccessLinkStatus =
  | 'ready'
  | 'setup_required'
  | 'expired_invitation'
  | 'wrong_account'
  | 'revoked'

export type TrustedAccessDeviceEnrollmentStatus = 'enrolled' | 'missing' | 'revoked'

export type TrustedAccessUserMessageKey =
  | 'access_ready'
  | 'secure_access_setup_required'
  | 'secure_access_invitation_expired'
  | 'secure_access_wrong_account'
  | 'secure_access_revoked'

export interface TrustedAccessReadiness {
  accessLinkStatus: TrustedAccessLinkStatus
  requiresAccessLinkSetup: boolean
  deviceEnrollmentStatus: TrustedAccessDeviceEnrollmentStatus
  userMessageKey: TrustedAccessUserMessageKey
}

export interface OwnerTrustedAccessStatus {
  requiresAccessLinkSetup: boolean
  accessLinkStatus:
    | 'ready'
    | 'setup_required'
    | 'invitation_pending'
    | 'expired_invitation'
    | 'revoked'
  hasPendingInvitation: boolean
  invitationExpiresAt: string | null
  hasDeviceEnrollment: boolean
  userMessageKey:
    | 'secure_access_ready'
    | 'secure_access_generate_link'
    | 'secure_access_send_link'
    | 'secure_access_invitation_expired'
}

type SignedCookieEnvelope = {
  payload: string
  signature: string
}

export interface TrustedAccessPendingCookie {
  invitationId: string
  ownerId: string
  trustedPersonId: string
  expectedEmail: string
  exp: number
}

export interface TrustedAccessOtpCookie {
  invitationId: string
  userId: string
  exp: number
}

export interface TrustedAccessDeviceCookie {
  deviceId: string
  ownerId: string
  trustedPersonId: string
  userId: string
  deviceSecret: string
}

export function hashTrustedAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateTrustedAccessToken(): string {
  return randomBytes(32).toString('hex')
}

export function buildTrustedAccessInvitationExpiry(now = Date.now()): string {
  return new Date(now + TRUSTED_ACCESS_INVITATION_TTL_MINUTES * 60_000).toISOString()
}

export function generateTrustedAccessOtp(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`
}

export function hashTrustedAccessOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function buildTrustedAccessOtpExpiry(now = Date.now()): string {
  return new Date(now + TRUSTED_ACCESS_OTP_TTL_MINUTES * 60_000).toISOString()
}

export function encryptTrustedAccessBootstrap(relationshipKey: string): string {
  return JSON.stringify(encrypt(relationshipKey, getEncryptionKey()))
}

export function decryptTrustedAccessBootstrap(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null
  const parsed = JSON.parse(ciphertext) as EncryptedData
  return decrypt(parsed, getEncryptionKey())
}

function getSigningSecret(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  return createHmac('sha256', 'trusted-access-cookie-secret').update(base).digest()
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('hex')
}

function encodeCookieValue<T>(payload: T): string {
  const rawPayload = JSON.stringify(payload)
  const envelope: SignedCookieEnvelope = {
    payload: rawPayload,
    signature: signPayload(rawPayload),
  }
  return Buffer.from(JSON.stringify(envelope)).toString('base64url')
}

function decodeCookieValue<T>(rawValue: string | null | undefined): T | null {
  if (!rawValue) return null

  try {
    const envelope = JSON.parse(Buffer.from(rawValue, 'base64url').toString('utf8')) as SignedCookieEnvelope
    const expectedSignature = signPayload(envelope.payload)
    const signatureBuffer = Buffer.from(envelope.signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (signatureBuffer.length !== expectedBuffer.length) return null
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null
    return JSON.parse(envelope.payload) as T
  } catch {
    return null
  }
}

export function createTrustedAccessPendingCookie(payload: Omit<TrustedAccessPendingCookie, 'exp'>): string {
  return encodeCookieValue<TrustedAccessPendingCookie>({
    ...payload,
    expectedEmail: payload.expectedEmail.toLowerCase().trim(),
    exp: Date.now() + TRUSTED_ACCESS_INVITATION_TTL_MINUTES * 60_000,
  })
}

export function readTrustedAccessPendingCookie(rawValue: string | null | undefined): TrustedAccessPendingCookie | null {
  const parsed = decodeCookieValue<TrustedAccessPendingCookie>(rawValue)
  if (!parsed || parsed.exp < Date.now()) return null
  return parsed
}

export function createTrustedAccessOtpCookie(payload: Omit<TrustedAccessOtpCookie, 'exp'>): string {
  return encodeCookieValue<TrustedAccessOtpCookie>({
    ...payload,
    exp: Date.now() + TRUSTED_ACCESS_OTP_TTL_MINUTES * 60_000,
  })
}

export function readTrustedAccessOtpCookie(rawValue: string | null | undefined): TrustedAccessOtpCookie | null {
  const parsed = decodeCookieValue<TrustedAccessOtpCookie>(rawValue)
  if (!parsed || parsed.exp < Date.now()) return null
  return parsed
}

export function createTrustedAccessDeviceCookie(
  payload: TrustedAccessDeviceCookie,
  existingRawValue?: string | null
): string {
  const existingEntries = readTrustedAccessDeviceCookieList(existingRawValue)
    .filter((entry) => !(entry.ownerId === payload.ownerId && entry.trustedPersonId === payload.trustedPersonId && entry.userId === payload.userId))
    .slice(-9)

  return encodeCookieValue([...existingEntries, payload])
}

export function readTrustedAccessDeviceCookieList(rawValue: string | null | undefined): TrustedAccessDeviceCookie[] {
  const parsed = decodeCookieValue<TrustedAccessDeviceCookie | TrustedAccessDeviceCookie[]>(rawValue)
  if (!parsed) return []
  return Array.isArray(parsed) ? parsed : [parsed]
}

export async function validateTrustedAccessDevice(
  adminClient: { from: (table: string) => any },
  params: {
    rawCookieValue: string | null | undefined
    ownerId: string
    trustedPersonId: string
    userId: string
  }
): Promise<{ enrolled: boolean; revoked: boolean }> {
  const cookie = readTrustedAccessDeviceCookieList(params.rawCookieValue).find(
    (entry) =>
      entry.ownerId === params.ownerId &&
      entry.trustedPersonId === params.trustedPersonId &&
      entry.userId === params.userId
  )
  if (!cookie) {
    return { enrolled: false, revoked: false }
  }

  const { data, error } = await adminClient
    .from('trusted_access_devices')
    .select('id, device_secret_hash, revoked_at')
    .eq('id', cookie.deviceId)
    .eq('owner_id', params.ownerId)
    .eq('trusted_person_id', params.trustedPersonId)
    .eq('user_id', params.userId)
    .maybeSingle()

  if (error || !data) {
    return { enrolled: false, revoked: false }
  }

  if (data.revoked_at) {
    return { enrolled: false, revoked: true }
  }

  return {
    enrolled: data.device_secret_hash === hashTrustedAccessToken(cookie.deviceSecret),
    revoked: false,
  }
}

export function readCookieValueFromHeader(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';').map((part) => part.trim())
  const match = parts.find((part) => part.startsWith(`${cookieName}=`))
  if (!match) return null
  return match.slice(cookieName.length + 1)
}

export function buildTrustedAccessReadiness(params: {
  hasExplicitShares: boolean
  hasDeviceEnrollment: boolean
  deviceRevoked?: boolean
  latestInvitationStatus?: string | null
}): TrustedAccessReadiness {
  if (params.deviceRevoked) {
    return {
      accessLinkStatus: 'revoked',
      requiresAccessLinkSetup: true,
      deviceEnrollmentStatus: 'revoked',
      userMessageKey: 'secure_access_revoked',
    }
  }

  if (!params.hasExplicitShares) {
    return {
      accessLinkStatus: params.hasDeviceEnrollment ? 'ready' : 'setup_required',
      requiresAccessLinkSetup: false,
      deviceEnrollmentStatus: params.hasDeviceEnrollment ? 'enrolled' : 'missing',
      userMessageKey: 'access_ready',
    }
  }

  if (params.hasDeviceEnrollment) {
    return {
      accessLinkStatus: 'ready',
      requiresAccessLinkSetup: false,
      deviceEnrollmentStatus: 'enrolled',
      userMessageKey: 'access_ready',
    }
  }

  if (params.latestInvitationStatus === 'expired') {
    return {
      accessLinkStatus: 'expired_invitation',
      requiresAccessLinkSetup: true,
      deviceEnrollmentStatus: 'missing',
      userMessageKey: 'secure_access_invitation_expired',
    }
  }

  return {
    accessLinkStatus: 'setup_required',
    requiresAccessLinkSetup: true,
    deviceEnrollmentStatus: 'missing',
    userMessageKey: 'secure_access_setup_required',
  }
}

export function buildOwnerTrustedAccessStatus(params: {
  hasExplicitShares: boolean
  hasPendingInvitation: boolean
  invitationExpiresAt: string | null
  hasDeviceEnrollment: boolean
}): OwnerTrustedAccessStatus {
  if (!params.hasExplicitShares) {
    return {
      requiresAccessLinkSetup: false,
      accessLinkStatus: params.hasDeviceEnrollment ? 'ready' : 'setup_required',
      hasPendingInvitation: false,
      invitationExpiresAt: null,
      hasDeviceEnrollment: params.hasDeviceEnrollment,
      userMessageKey: params.hasDeviceEnrollment ? 'secure_access_ready' : 'secure_access_generate_link',
    }
  }

  if (params.hasDeviceEnrollment) {
    return {
      requiresAccessLinkSetup: false,
      accessLinkStatus: 'ready',
      hasPendingInvitation: params.hasPendingInvitation,
      invitationExpiresAt: params.invitationExpiresAt,
      hasDeviceEnrollment: true,
      userMessageKey: 'secure_access_ready',
    }
  }

  if (params.hasPendingInvitation) {
    return {
      requiresAccessLinkSetup: true,
      accessLinkStatus: 'invitation_pending',
      hasPendingInvitation: true,
      invitationExpiresAt: params.invitationExpiresAt,
      hasDeviceEnrollment: false,
      userMessageKey: 'secure_access_send_link',
    }
  }

  return {
    requiresAccessLinkSetup: true,
    accessLinkStatus: params.invitationExpiresAt ? 'expired_invitation' : 'setup_required',
    hasPendingInvitation: false,
    invitationExpiresAt: params.invitationExpiresAt,
    hasDeviceEnrollment: false,
    userMessageKey: params.invitationExpiresAt ? 'secure_access_invitation_expired' : 'secure_access_generate_link',
  }
}

export async function fetchTrustedAccessDevicePairSet(
  adminClient: { from: (table: string) => any },
  pairs: Array<{ ownerId: string; trustedPersonId: string; userId?: string }>
): Promise<Set<string>> {
  const filteredPairs = pairs.filter((pair) => pair.ownerId && pair.trustedPersonId)
  if (filteredPairs.length === 0) {
    return new Set()
  }

  const ownerIds = [...new Set(filteredPairs.map((pair) => pair.ownerId))]
  const trustedPersonIds = [...new Set(filteredPairs.map((pair) => pair.trustedPersonId))]
  const userIds = [...new Set(filteredPairs.map((pair) => pair.userId).filter(Boolean) as string[])]

  let query = adminClient
    .from('trusted_access_devices')
    .select('owner_id, trusted_person_id, user_id')
    .in('owner_id', ownerIds)
    .in('trusted_person_id', trustedPersonIds)
    .is('revoked_at', null)

  if (userIds.length > 0) {
    query = query.in('user_id', userIds)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const requested = new Set(
    filteredPairs.map((pair) => `${pair.ownerId}:${pair.trustedPersonId}:${pair.userId ?? '*'}`)
  )
  const pairSet = new Set<string>()
  for (const row of data ?? []) {
    const key = `${row.owner_id}:${row.trusted_person_id}:${row.user_id ?? '*'}`
    if (requested.has(key)) {
      pairSet.add(key)
    }
    pairSet.add(`${row.owner_id}:${row.trusted_person_id}:*`)
  }

  return pairSet
}

export async function fetchLatestTrustedAccessInvitationMap(
  adminClient: { from: (table: string) => any },
  pairs: Array<{ ownerId: string; trustedPersonId: string }>
): Promise<Map<string, { status: string; expiresAt: string | null }>> {
  const filteredPairs = pairs.filter((pair) => pair.ownerId && pair.trustedPersonId)
  if (filteredPairs.length === 0) {
    return new Map()
  }

  const ownerIds = [...new Set(filteredPairs.map((pair) => pair.ownerId))]
  const trustedPersonIds = [...new Set(filteredPairs.map((pair) => pair.trustedPersonId))]

  const { data, error } = await adminClient
    .from('trusted_access_invitations')
    .select('owner_id, trusted_person_id, status, expires_at, created_at')
    .in('owner_id', ownerIds)
    .in('trusted_person_id', trustedPersonIds)

  if (error) {
    throw new Error(error.message)
  }

  const requestedPairs = new Set(filteredPairs.map((pair) => `${pair.ownerId}:${pair.trustedPersonId}`))
  const invitationMap = new Map<string, { status: string; expiresAt: string | null; createdAtMs: number }>()

  for (const row of data ?? []) {
    const key = `${row.owner_id}:${row.trusted_person_id}`
    if (!requestedPairs.has(key)) {
      continue
    }

    const currentCreatedAtMs = row.created_at ? new Date(row.created_at).getTime() : 0
    const existing = invitationMap.get(key)
    if (existing && existing.createdAtMs >= currentCreatedAtMs) {
      continue
    }

    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : NaN
    const normalizedStatus =
      row.status === 'pending' && Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()
        ? 'expired'
        : row.status
    invitationMap.set(key, {
      status: normalizedStatus,
      expiresAt: row.expires_at ?? null,
      createdAtMs: currentCreatedAtMs,
    })
  }

  return new Map(
    Array.from(invitationMap.entries()).map(([key, value]) => [
      key,
      { status: value.status, expiresAt: value.expiresAt },
    ])
  )
}
