import { type Page } from '@playwright/test'
import Redis from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import {
  CONSENT_COOKIE_NAME,
  CONSENT_VERSION,
  PRIVACY_POLICY_VERSION,
} from '../../../src/lib/consent/constants'
import {
  deriveMasterKey,
  fromBase64,
  generateRelationshipKey,
  toBase64,
  unwrapKey,
  wrapKey,
} from '../../../src/lib/security/document-e2ee'
import type { DocumentCategory } from '../../../src/types/database'
import { hashTrustedAccessOtp } from '../../../src/lib/security/trusted-access'
import { getBaseUrl, requireE2EEnv } from './env'

const baseUrl = getBaseUrl()

const runIdPrefix = process.env.E2E_RUN_ID ?? 'e2e'
const globalRunId = `${runIdPrefix}-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`

let sequence = 0

const BASIC_FALLBACK_PRICE_ID =
  process.env.STRIPE_PRICE_BASIC_MONTHLY ??
  process.env.STRIPE_PRICE_BASIC_YEARLY ??
  'price_basic_monthly_test'
const PREMIUM_FALLBACK_PRICE_ID =
  process.env.STRIPE_PRICE_PREMIUM_MONTHLY ??
  process.env.STRIPE_PRICE_ID ??
  'price_1sr6skcaexnimhccdbmdf7e6'

export const DEFAULT_VAULT_PASSPHRASE = 'E2E-Vault-Passphrase-123!'
export const DEFAULT_RECOVERY_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

type Tier = 'free' | 'basic' | 'premium'

export interface SeededUser {
  id: string
  email: string
  password: string
  fullName: string
  tier: Tier
  vaultPassphrase?: string
}

interface CleanupState {
  authUserIds: Set<string>
  ownerIds: Set<string>
}

export interface TrustedRelationshipOptions {
  ownerId: string
  trustedUserId: string
  trustedEmail: string
  trustedName: string
  relationship?: string
  accessLevel?: 'immediate' | 'emergency' | 'after_confirmation'
  invitationStatus?: 'pending' | 'sent' | 'accepted'
  emailStatus?: 'pending' | 'sending' | 'sent' | 'failed' | null
  relationshipStatus?:
    | 'invited'
    | 'accepted_pending_setup'
    | 'setup_link_sent'
    | 'active'
    | 'revoked'
  linked?: boolean
}

export interface SeededRelationship {
  trustedPersonId: string
  relationshipKey: string
}

export interface SeededDocument {
  id: string
  title: string
  subcategoryId: string | null
}

interface TrustedPersonRow {
  id: string
  email: string
  invitation_token: string | null
  relationship_status: string | null
  invitation_status: string | null
}

interface TrustedAccessInvitationRow {
  id: string
  owner_id: string
  trusted_person_id: string
  status: string
  expires_at: string
}

type SharePermission = 'view' | 'download'

function getSupabaseAdmin() {
  return createClient(
    requireE2EEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireE2EEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false },
    },
  )
}

function getRedis() {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  })
}

function nextLabel(prefix: string) {
  sequence += 1
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${globalRunId}-${safePrefix}-${sequence}`
}

function makeEmail(label: string) {
  return `${label}@e2e.lebensordner.local`
}

async function ensureAuthUser(email: string, password: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const admin = supabaseAdmin.auth.admin
  const createResult = await admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (!createResult.error && createResult.data.user) {
    return createResult.data.user
  }

  const alreadyExists = createResult.error?.message
    ?.toLowerCase()
    .includes('already been registered')
  if (!alreadyExists) {
    throw createResult.error ?? new Error(`Failed to create auth user for ${email}`)
  }

  let page = 1
  while (page <= 10) {
    const listed = await admin.listUsers({ page, perPage: 1000 })
    if (listed.error) throw listed.error
    const existing = listed.data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    )
    if (existing) {
      const updated = await admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        ban_duration: 'none',
      })
      if (updated.error || !updated.data.user) {
        throw updated.error ?? new Error(`Failed to refresh auth user for ${email}`)
      }
      return updated.data.user
    }
    if (listed.data.users.length < 1000) break
    page += 1
  }

  throw new Error(`Unable to resolve auth user for ${email}`)
}

async function seedPrivacyConsent(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const consentTypes = ['privacy_policy', 'health_data']
  const { error: deleteError } = await supabaseAdmin
    .from('consent_ledger')
    .delete()
    .eq('user_id', userId)
    .in('consent_type', consentTypes)
  if (deleteError) throw deleteError

  const { error: insertError } = await supabaseAdmin.from('consent_ledger').insert([
    {
      user_id: userId,
      consent_type: 'privacy_policy',
      granted: true,
      version: PRIVACY_POLICY_VERSION,
    },
    {
      user_id: userId,
      consent_type: 'health_data',
      granted: true,
      version: CONSENT_VERSION,
    },
  ])
  if (insertError) throw insertError
}

async function resetLoginSecurityState(email: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const normalizedEmail = email.trim().toLowerCase()
  const now = new Date().toISOString()
  const redis = getRedis()

  await supabaseAdmin
    .from('auth_lockouts')
    .update({ unlocked_at: now })
    .eq('email', normalizedEmail)
    .is('unlocked_at', null)

  await supabaseAdmin
    .from('rate_limits')
    .delete()
    .eq('endpoint', '/api/auth/login')

  try {
    await redis.connect()
    const keyPattern = 'rate:/api/auth/login:login_ip:*'
    let cursor = '0'
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== '0')

    await redis.del(`rate:/api/auth/login:login_email:${normalizedEmail}`)
  } finally {
    redis.disconnect()
  }
}

async function resetTrustedPersonInviteRateLimitState(userId: string) {
  const redis = getRedis()

  try {
    await redis.connect()
    const keyPattern = 'rate:/api/trusted-person/invite:*'
    let cursor = '0'
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== '0')

    await redis.del(`rate:/api/trusted-person/invite:invite:${userId}`)
  } finally {
    redis.disconnect()
  }
}
async function seedProfile(user: SeededUser) {
  const supabaseAdmin = getSupabaseAdmin()
  const stripePriceId =
    user.tier === 'premium'
      ? PREMIUM_FALLBACK_PRICE_ID
      : user.tier === 'basic'
        ? BASIC_FALLBACK_PRICE_ID
        : null
  const subscriptionStatus = user.tier === 'free' ? null : 'active'

  const { error } = await supabaseAdmin.from('profiles').upsert({
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    onboarding_completed: true,
    health_data_consent_granted: true,
    health_data_consent_timestamp: new Date().toISOString(),
    subscription_status: subscriptionStatus,
    stripe_price_id: stripePriceId,
    secured_categories: [],
  })
  if (error) throw error

  await seedPrivacyConsent(user.id)
}

export async function seedVaultForUser(
  userId: string,
  passphrase = DEFAULT_VAULT_PASSPHRASE,
  recoveryKeyHex = DEFAULT_RECOVERY_KEY,
) {
  const supabaseAdmin = getSupabaseAdmin()
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(32))
  const recoverySalt = globalThis.crypto.getRandomValues(new Uint8Array(32))
  const kdfParams = { iterations: 600000, hash: 'SHA-256' }
  const passphraseKey = await deriveMasterKey(passphrase, salt, kdfParams)
  const recoveryKey = await deriveMasterKey(
    recoveryKeyHex,
    recoverySalt,
    kdfParams,
  )
  const masterKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-KW', length: 256 },
    true,
    ['wrapKey', 'unwrapKey'],
  )

  const wrappedMk = await wrapKey(masterKey, passphraseKey)
  const wrappedMkWithRecovery = await wrapKey(masterKey, recoveryKey)

  const { error } = await supabaseAdmin.from('user_vault_keys').upsert(
    {
      user_id: userId,
      kdf_salt: toBase64(salt),
      kdf_params: kdfParams,
      wrapped_mk: wrappedMk,
      wrapped_mk_with_recovery: wrappedMkWithRecovery,
      recovery_key_salt: toBase64(recoverySalt),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

async function getOwnerMasterKey(userId: string, passphrase: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('user_vault_keys')
    .select('kdf_salt, kdf_params, wrapped_mk')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw error ?? new Error(`Missing vault keys for ${userId}`)
  }

  const passphraseKey = await deriveMasterKey(
    passphrase,
    fromBase64(data.kdf_salt),
    data.kdf_params as { iterations: number; hash: string },
  )
  return unwrapKey(data.wrapped_mk, passphraseKey, 'AES-KW')
}

export function createScenario(scope: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const cleanupState: CleanupState = {
    authUserIds: new Set<string>(),
    ownerIds: new Set<string>(),
  }

  return {
    async createUser(options: {
      label: string
      fullName: string
      tier?: Tier
      password?: string
      withVault?: boolean
      vaultPassphrase?: string
    }): Promise<SeededUser> {
      const label = nextLabel(`${scope}-${options.label}`)
      const email = makeEmail(label)
      const password = options.password ?? `Pw-${label}-123!`
      const authUser = await ensureAuthUser(email, password)
      cleanupState.authUserIds.add(authUser.id)
      cleanupState.ownerIds.add(authUser.id)

      const user: SeededUser = {
        id: authUser.id,
        email,
        password,
        fullName: options.fullName,
        tier: options.tier ?? 'basic',
        vaultPassphrase: options.vaultPassphrase,
      }
      await seedProfile(user)
      if (options.withVault) {
        const vaultPassphrase =
          options.vaultPassphrase ?? DEFAULT_VAULT_PASSPHRASE
        await seedVaultForUser(user.id, vaultPassphrase)
        user.vaultPassphrase = vaultPassphrase
      }
      return user
    },

    async seedTrustedRelationship(
      options: TrustedRelationshipOptions,
    ): Promise<SeededRelationship> {
      cleanupState.ownerIds.add(options.ownerId)
      const relationshipKey = await generateRelationshipKey()
      const accessLevel = options.accessLevel ?? 'immediate'
      const invitationStatus = options.invitationStatus ?? 'accepted'
      const now = new Date().toISOString()
      const invitationSentAt =
        invitationStatus === 'accepted' ? now : null
      const invitationAcceptedAt =
        invitationStatus === 'accepted' ? now : null
      const invitationExpiresAt =
        invitationStatus === 'accepted'
          ? null
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const emailStatus =
        options.emailStatus === undefined ? 'sent' : options.emailStatus
      const linkedUserId = options.linked === false ? null : options.trustedUserId
      const relationshipStatus =
        options.relationshipStatus ??
        (invitationStatus === 'accepted'
          ? linkedUserId
            ? 'active'
            : 'accepted_pending_setup'
          : 'invited')

      const insertResult = await supabaseAdmin
        .from('trusted_persons')
        .insert({
          user_id: options.ownerId,
          name: options.trustedName,
          email: options.trustedEmail,
          relationship: options.relationship ?? 'Familie',
          access_level: accessLevel,
          invitation_status: invitationStatus,
          invitation_sent_at: invitationSentAt,
          invitation_expires_at: invitationExpiresAt,
          invitation_accepted_at: invitationAcceptedAt,
          linked_user_id: linkedUserId,
          email_status: emailStatus,
          relationship_status: relationshipStatus,
          is_active: true,
        })
        .select('id')
        .single()

      if (insertResult.error || !insertResult.data) {
        throw insertResult.error ?? new Error('Failed to seed trusted relationship')
      }

      return {
        trustedPersonId: insertResult.data.id,
        relationshipKey,
      }
    },

    async seedRelationshipKey(options: {
      ownerId: string
      trustedPersonId: string
      ownerPassphrase: string
      relationshipKey: string
    }) {
      const ownerMasterKey = await getOwnerMasterKey(
        options.ownerId,
        options.ownerPassphrase,
      )
      const relationshipCryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        Uint8Array.from(
          options.relationshipKey.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [],
        ),
        { name: 'AES-KW', length: 256 },
        true,
        ['wrapKey', 'unwrapKey'],
      )
      const wrappedRelationshipKey = await wrapKey(
        relationshipCryptoKey,
        ownerMasterKey,
      )

      const { error } = await supabaseAdmin
        .from('document_relationship_keys')
        .upsert(
          {
            owner_id: options.ownerId,
            trusted_person_id: options.trustedPersonId,
            wrapped_rk: wrappedRelationshipKey,
          },
          { onConflict: 'owner_id,trusted_person_id' },
        )
      if (error) throw error
    },

    async seedDocument(options: {
      ownerId: string
      title: string
      category?: DocumentCategory
      subcategoryId?: string | null
      extraSecurityEnabled?: boolean
    }): Promise<SeededDocument> {
      cleanupState.ownerIds.add(options.ownerId)
      const fileLabel = nextLabel(options.title)
      const insertResult = await supabaseAdmin
        .from('documents')
        .insert({
          user_id: options.ownerId,
          category: options.category ?? 'identitaet',
          title: options.title,
          file_name: `${fileLabel}.pdf`,
          file_path: `${options.ownerId}/seeded/${fileLabel}.pdf`,
          file_size: 2048,
          file_type: 'application/pdf',
          is_encrypted: false,
          extra_security_enabled: options.extraSecurityEnabled ?? false,
          subcategory_id: options.subcategoryId ?? null,
          tags: [],
        })
        .select('id, title, subcategory_id')
        .single()

      if (insertResult.error || !insertResult.data) {
        throw insertResult.error ?? new Error('Failed to seed document')
      }

      return {
        id: insertResult.data.id,
        title: insertResult.data.title,
        subcategoryId: insertResult.data.subcategory_id,
      }
    },

    async seedSubcategory(options: {
      ownerId: string
      parentCategory?: DocumentCategory
      name: string
    }) {
      cleanupState.ownerIds.add(options.ownerId)
      const result = await supabaseAdmin
        .from('subcategories')
        .insert({
          user_id: options.ownerId,
          parent_category: options.parentCategory ?? 'identitaet',
          name: options.name,
          icon: 'folder',
        })
        .select('id, name')
        .single()

      if (result.error || !result.data) {
        throw result.error ?? new Error('Failed to seed subcategory')
      }
      return result.data
    },

    async findDocumentByTitle(options: {
      ownerId: string
      title: string
    }) {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('id, title, subcategory_id')
        .eq('user_id', options.ownerId)
        .eq('title', options.title)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data
    },

    async shareDocument(options: {
      ownerId: string
      trustedPersonId: string
      documentId: string
      permission?: SharePermission
    }) {
      const { error } = await supabaseAdmin.from('document_share_tokens').upsert(
        {
          owner_id: options.ownerId,
          trusted_person_id: options.trustedPersonId,
          document_id: options.documentId,
          wrapped_dek_for_tp: 'e2e-share-token',
          permission: options.permission ?? 'view',
        },
        { onConflict: 'document_id,trusted_person_id' },
      )
      if (error) throw error
    },

    async getTrustedPersonByEmail(options: {
      ownerId: string
      trustedEmail: string
    }): Promise<TrustedPersonRow | null> {
      const { data, error } = await supabaseAdmin
        .from('trusted_persons')
        .select('id, email, invitation_token, relationship_status, invitation_status')
        .eq('user_id', options.ownerId)
        .ilike('email', options.trustedEmail.trim().toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data
    },

    async getLatestTrustedAccessInvitation(options: {
      trustedPersonId: string
    }): Promise<TrustedAccessInvitationRow | null> {
      const { data, error } = await supabaseAdmin
        .from('trusted_access_invitations')
        .select('id, owner_id, trusted_person_id, status, expires_at')
        .eq('trusted_person_id', options.trustedPersonId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data
    },

    async setLatestTrustedAccessOtp(options: {
      invitationId: string
      otp: string
    }) {
      const { data: challenge, error: challengeError } = await supabaseAdmin
        .from('trusted_access_otp_challenges')
        .select('id')
        .eq('invitation_id', options.invitationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (challengeError) throw challengeError
      if (!challenge) {
        throw new Error(`No OTP challenge found for invitation ${options.invitationId}`)
      }

      const { error: updateError } = await supabaseAdmin
        .from('trusted_access_otp_challenges')
        .update({
          code_hash: hashTrustedAccessOtp(options.otp),
          attempt_count: 0,
          consumed_at: null,
        })
        .eq('id', challenge.id)

      if (updateError) throw updateError
    },

    async authenticatePage(
      page: Page,
      user: SeededUser,
      options?: {
        vaultPassphrase?: string
        relationshipKeyByOwnerId?: Record<string, string>
      },
    ) {
      await page.context().addCookies([
        {
          name: CONSENT_COOKIE_NAME,
          value: JSON.stringify({
            necessary: true,
            analytics: false,
            marketing: false,
            version: CONSENT_VERSION,
          }),
          url: baseUrl,
        },
      ])

      const initData = {
        vaultPassphrase: options?.vaultPassphrase ?? user.vaultPassphrase ?? null,
        relationshipKeyByOwnerId: options?.relationshipKeyByOwnerId ?? {},
      }
      await page.addInitScript((data: typeof initData) => {
        if (data.vaultPassphrase) {
          window.sessionStorage.setItem('lo_v_p', data.vaultPassphrase)
        }
        for (const [ownerId, key] of Object.entries(data.relationshipKeyByOwnerId)) {
          window.localStorage.setItem(`rk_${ownerId}`, key)
        }
      }, initData)

      await resetLoginSecurityState(user.email)

      await page.goto('/anmelden')
      await page.getByLabel('E-Mail-Adresse').fill(user.email)
      await page.locator('#password').fill(user.password)
      await page.getByRole('button', { name: 'Anmelden' }).click()
      await page.waitForURL(/\/(dashboard|policy-update)/, { timeout: 30000 })

      if (page.url().includes('/policy-update')) {
        await page.getByTestId('policy-update-checkbox').check()
        await page.getByTestId('policy-update-content').evaluate((node) => {
          node.scrollTop = node.scrollHeight
          node.dispatchEvent(new Event('scroll'))
        })
        await page.getByTestId('policy-update-accept').click()
        await page.waitForURL('**/dashboard')
      }
    },

    async resetTrustedPersonInviteRateLimitState(userId: string) {
      await resetTrustedPersonInviteRateLimitState(userId)
    },

    async cleanup() {
      const ownerIds = [...cleanupState.ownerIds]
      const supabaseAdmin = getSupabaseAdmin()
      if (ownerIds.length > 0) {
        const { data: docs } = await supabaseAdmin
          .from('documents')
          .select('file_path')
          .in('user_id', ownerIds)

        const paths = (docs ?? [])
          .map((doc) => doc.file_path)
          .filter((value): value is string => Boolean(value))
        if (paths.length > 0) {
          await supabaseAdmin.storage.from('documents').remove(paths)
        }

        await supabaseAdmin
          .from('document_share_tokens')
          .delete()
          .in('owner_id', ownerIds)
        await supabaseAdmin
          .from('document_relationship_keys')
          .delete()
          .in('owner_id', ownerIds)
        await supabaseAdmin
          .from('documents')
          .delete()
          .in('user_id', ownerIds)
        await supabaseAdmin
          .from('subcategories')
          .delete()
          .in('user_id', ownerIds)
        await supabaseAdmin
          .from('trusted_persons')
          .delete()
          .in('user_id', ownerIds)
      }

      const authUserIds = [...cleanupState.authUserIds]
      if (authUserIds.length > 0) {
        await supabaseAdmin
          .from('user_vault_keys')
          .delete()
          .in('user_id', authUserIds)
        await supabaseAdmin
          .from('consent_ledger')
          .delete()
          .in('user_id', authUserIds)
        await supabaseAdmin
          .from('profiles')
          .delete()
          .in('id', authUserIds)
        for (const authUserId of authUserIds) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(authUserId)
          } catch {
            // Ignore cleanup failures so one leaked user does not hide the test result.
          }
        }
      }
    },
  }
}

