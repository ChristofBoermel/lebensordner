import { randomUUID } from 'crypto'
import { getRedis } from '@/lib/redis/client'
import { emitStructuredError } from '@/lib/errors/structured-logger'

const PENDING_AUTH_TTL_SECONDS = 5 * 60

type PendingAuthChallengeRecord = {
  challengeId: string
  userId: string
  email: string
  accessToken: string
  refreshToken: string
  rememberMe: boolean
  clientIp: string
  userAgent: string
  createdAt: string
}

function getChallengeKey(challengeId: string): string {
  return `pending-auth:${challengeId}`
}

export async function createPendingAuthChallenge(input: Omit<PendingAuthChallengeRecord, 'challengeId' | 'createdAt'>): Promise<{ challengeId: string; expiresInSeconds: number }> {
  const challengeId = randomUUID()
  const record: PendingAuthChallengeRecord = {
    ...input,
    challengeId,
    createdAt: new Date().toISOString(),
  }

  try {
    const redis = getRedis()
    await redis.set(getChallengeKey(challengeId), JSON.stringify(record), 'EX', PENDING_AUTH_TTL_SECONDS)
    return { challengeId, expiresInSeconds: PENDING_AUTH_TTL_SECONDS }
  } catch (error) {
    emitStructuredError({
      error_type: 'auth',
      error_message: `Failed to create pending auth challenge: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: 'lib/security/pending-auth',
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw new Error('PENDING_AUTH_UNAVAILABLE')
  }
}

export async function getPendingAuthChallenge(challengeId: string): Promise<PendingAuthChallengeRecord | null> {
  try {
    const redis = getRedis()
    const raw = await redis.get(getChallengeKey(challengeId))
    if (!raw) return null
    return JSON.parse(raw) as PendingAuthChallengeRecord
  } catch (error) {
    emitStructuredError({
      error_type: 'auth',
      error_message: `Failed to read pending auth challenge: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: 'lib/security/pending-auth',
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw new Error('PENDING_AUTH_UNAVAILABLE')
  }
}

export async function consumePendingAuthChallenge(challengeId: string): Promise<PendingAuthChallengeRecord | null> {
  try {
    const redis = getRedis()
    const key = getChallengeKey(challengeId)
    const raw = await redis.get(key)
    if (!raw) return null
    await redis.del(key)
    return JSON.parse(raw) as PendingAuthChallengeRecord
  } catch (error) {
    emitStructuredError({
      error_type: 'auth',
      error_message: `Failed to consume pending auth challenge: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: 'lib/security/pending-auth',
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw new Error('PENDING_AUTH_UNAVAILABLE')
  }
}
