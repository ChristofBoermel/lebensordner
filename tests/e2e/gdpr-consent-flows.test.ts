import { test, expect, type Browser } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import fs from 'fs'
import path from 'path'
import { CONSENT_VERSION, PRIVACY_POLICY_VERSION, CONSENT_COOKIE_NAME } from '../../src/lib/consent/constants'
import { getE2EUsers } from '../fixtures/users'

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.E2E_BASE_URL ??
  'http://127.0.0.1:3000'

const requireEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
)

const authDir = path.join(process.cwd(), 'test-results', 'auth')
const storageStates = {
  unconsented: path.join(authDir, 'unconsented.json'),
  consented: path.join(authDir, 'consented.json'),
  outdatedPolicy: path.join(authDir, 'outdated-policy.json'),
}

const ensureStorageStateFiles = () => {
  fs.mkdirSync(authDir, { recursive: true })
  const emptyState = JSON.stringify({ cookies: [], origins: [] })
  for (const filePath of Object.values(storageStates)) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, emptyState)
    }
  }
}

ensureStorageStateFiles()

const ensureAuthUser = async (email: string, password: string) => {
  const admin = supabase.auth.admin
  if (!admin?.listUsers || !admin?.createUser || !admin?.updateUserById) {
    throw new Error('Supabase admin API unavailable: auth.admin.listUsers/createUser/updateUserById required')
  }

  const normalizedEmail = email.toLowerCase()
  const { data: createdData, error: createError } = await admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (!createError && createdData.user) {
    return createdData.user
  }

  const alreadyExists = createError?.message?.toLowerCase().includes('already been registered')
  if (!alreadyExists) {
    throw createError ?? new Error('Failed to create test user')
  }

  // Resolve existing auth user id from profile first, then fallback to auth admin listing.
  let existingUserId: string | null = null
  const { data: profileRecord, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .limit(1)
    .maybeSingle()
  if (profileLookupError) throw profileLookupError
  existingUserId = profileRecord?.id ?? null

  if (!existingUserId) {
    let page = 1
    const perPage = 1000
    while (page <= 10) {
      const { data, error } = await admin.listUsers({ page, perPage })
      if (error) throw error
      const existing = data?.users?.find((user) => user.email?.toLowerCase() === normalizedEmail)
      if (existing) {
        existingUserId = existing.id
        break
      }
      if (!data?.users || data.users.length < perPage) break
      page += 1
    }
  }

  if (!existingUserId) {
    throw new Error(`Unable to resolve existing auth user for ${normalizedEmail}`)
  }

  const { data: updatedData, error: updateError } = await admin.updateUserById(existingUserId, {
    password,
    email_confirm: true,
    ban_duration: 'none',
  })
  if (updateError || !updatedData.user) {
    throw updateError ?? new Error(`Failed to update auth user for ${normalizedEmail}`)
  }
  return updatedData.user
}

const upsertProfile = async (
  userId: string,
  email: string,
  overrides: Partial<{
    onboarding_completed: boolean
    health_data_consent_granted: boolean
    health_data_consent_timestamp: string | null
  }> = {}
) => {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    onboarding_completed: true,
    ...overrides,
  })
  if (error) throw error
}

const resetLoginSecurityState = async (email: string) => {
  const now = new Date().toISOString()
  const normalizedEmail = email.toLowerCase()

  const emailsToReset = email === normalizedEmail ? [normalizedEmail] : [email, normalizedEmail]
  for (const currentEmail of emailsToReset) {
    const { error: unlockError } = await supabase
      .from('auth_lockouts')
      .update({ unlocked_at: now })
      .eq('email', currentEmail)
      .is('unlocked_at', null)
    if (unlockError) throw unlockError

    const { error: resetFailuresError } = await supabase
      .from('rate_limits')
      .delete()
      .eq('identifier', `login_email:${currentEmail}`)
      .eq('endpoint', '/api/auth/login')
    if (resetFailuresError) throw resetFailuresError
  }
}

const resetConsentLedger = async (userId: string, consentType: string) => {
  const { error } = await supabase
    .from('consent_ledger')
    .delete()
    .eq('user_id', userId)
    .eq('consent_type', consentType)
  if (error) throw error
}

const insertConsent = async (
  userId: string,
  consentType: 'health_data' | 'privacy_policy',
  granted: boolean,
  version: string
) => {
  const { error } = await supabase.from('consent_ledger').insert({
    user_id: userId,
    consent_type: consentType,
    granted,
    version,
  })
  if (error) throw error
}

const getConsentRecords = async (userId: string, consentType: string) => {
  const { data, error } = await supabase
    .from('consent_ledger')
    .select('*')
    .eq('user_id', userId)
    .eq('consent_type', consentType)
    .order('timestamp', { ascending: false })
  if (error) throw error
  return data ?? []
}

type SessionCookie = {
  name: string
  value: string
  options: CookieOptions
}

const toPlaywrightSameSite = (sameSite?: CookieOptions['sameSite']) => {
  if (sameSite === 'strict') return 'Strict' as const
  if (sameSite === 'none') return 'None' as const
  return 'Lax' as const
}

const createAuthCookiesForUser = async (email: string, password: string) => {
  const cookieStore = new Map<string, SessionCookie>()

  const authClient = createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, { name, value, options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, { name, value: '', options: { ...options, maxAge: 0 } })
        },
      },
    }
  )

  const { error } = await authClient.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Direct Supabase sign-in failed for bootstrap user: ${error.message}`)
  }

  const url = new URL(baseURL)
  const now = Math.floor(Date.now() / 1000)
  return Array.from(cookieStore.values()).map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: url.hostname,
    path: cookie.options.path ?? '/',
    httpOnly: cookie.options.httpOnly ?? false,
    secure: cookie.options.secure ?? url.protocol === 'https:',
    sameSite: toPlaywrightSameSite(cookie.options.sameSite),
    expires:
      typeof cookie.options.maxAge === 'number'
        ? now + cookie.options.maxAge
        : cookie.options.maxAge === 0
          ? 0
          : -1,
  }))
}

const ensureStorageState = async (
  browser: Browser,
  email: string,
  password: string,
  filePath: string,
  userLabel: string
) => {
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if ((parsed?.cookies?.length ?? 0) > 0 || (parsed?.origins?.length ?? 0) > 0) {
        return
      }
    } catch {
      // Recreate state if file is invalid
    }
  }
  fs.mkdirSync(authDir, { recursive: true })
  const context = await browser.newContext()
  const authCookies = await createAuthCookiesForUser(email, password)
  await context.addCookies([
    ...authCookies,
    {
      name: CONSENT_COOKIE_NAME,
      value: JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        version: CONSENT_VERSION,
      }),
      url: baseURL,
    },
  ])
  const page = await context.newPage()
  await page.goto('/dashboard')
  await page.waitForURL(/\/(dashboard|policy-update)/, { timeout: 15000 })

  if (page.url().includes('/policy-update')) {
    await page.getByTestId('policy-update-checkbox').check()
    await page.getByTestId('policy-update-content').evaluate((node) => {
      node.scrollTop = node.scrollHeight
      node.dispatchEvent(new Event('scroll'))
    })
    const acceptResponse = page.waitForResponse((response) =>
      response.url().includes('/api/consent/accept-privacy-policy') &&
      response.request().method() === 'POST'
    )
    await page.getByTestId('policy-update-accept').click()
    await acceptResponse
    await page.waitForURL('**/dashboard')
  }

  await context.storageState({ path: filePath })
  await context.close()
}

const { unconsented, consented, outdatedPolicy } = getE2EUsers()

const makeRunScopedEmail = (email: string, tag: string) => {
  const parts = email.split('@')
  if (parts.length !== 2) return email
  const [localPart, domain] = parts
  const runId = process.env.GITHUB_RUN_ID ?? `${Date.now()}`
  return `${localPart}+${tag}-${runId}@${domain}`
}

let unconsentedEmail = makeRunScopedEmail(unconsented.email, 'unconsented')
let consentedEmail = makeRunScopedEmail(consented.email, 'consented')
let outdatedPolicyEmail = makeRunScopedEmail(outdatedPolicy.email, 'policy')

test.describe.configure({ mode: 'serial', timeout: 120000 })

let unconsentedUserId = ''
let consentedUserId = ''
let outdatedPolicyUserId = ''

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000)
  await resetLoginSecurityState(unconsentedEmail)
  await resetLoginSecurityState(consentedEmail)
  await resetLoginSecurityState(outdatedPolicyEmail)

  const unconsentedUser = await ensureAuthUser(unconsentedEmail, unconsented.password)
  unconsentedUserId = unconsentedUser.id
  await upsertProfile(unconsentedUserId, unconsentedEmail, {
    onboarding_completed: true,
    health_data_consent_granted: false,
    health_data_consent_timestamp: null,
  })
  await resetConsentLedger(unconsentedUserId, 'health_data')
  await resetConsentLedger(unconsentedUserId, 'privacy_policy')
  await insertConsent(unconsentedUserId, 'privacy_policy', true, PRIVACY_POLICY_VERSION)

  const consentedUser = await ensureAuthUser(consentedEmail, consented.password)
  consentedUserId = consentedUser.id
  await upsertProfile(consentedUserId, consentedEmail, {
    onboarding_completed: true,
    health_data_consent_granted: true,
    health_data_consent_timestamp: new Date().toISOString(),
  })
  await resetConsentLedger(consentedUserId, 'health_data')
  await insertConsent(consentedUserId, 'health_data', true, CONSENT_VERSION)
  await resetConsentLedger(consentedUserId, 'privacy_policy')
  await insertConsent(consentedUserId, 'privacy_policy', true, PRIVACY_POLICY_VERSION)

  const policyUser = await ensureAuthUser(outdatedPolicyEmail, outdatedPolicy.password)
  outdatedPolicyUserId = policyUser.id
  await upsertProfile(outdatedPolicyUserId, outdatedPolicyEmail, {
    onboarding_completed: true,
  })

  await ensureStorageState(browser, unconsentedEmail, unconsented.password, storageStates.unconsented, 'unconsented')
  await ensureStorageState(browser, consentedEmail, consented.password, storageStates.consented, 'consented')
  await ensureStorageState(browser, outdatedPolicyEmail, outdatedPolicy.password, storageStates.outdatedPolicy, 'outdatedPolicy')
})

test.describe('Health Consent Grant Flow', () => {
  test.use({ storageState: storageStates.unconsented })

  test('decline then grant consent from /notfall', async ({ page }) => {
    await resetConsentLedger(unconsentedUserId, 'health_data')
    await upsertProfile(unconsentedUserId, unconsentedEmail, {
      health_data_consent_granted: false,
      health_data_consent_timestamp: null,
    })

    await page.goto('/notfall')
    await expect(page.getByTestId('consent-modal-health_data')).toBeVisible()

    await page.getByRole('button', { name: 'Ablehnen' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/notfall')
    await expect(page.getByTestId('consent-modal-health_data')).toBeVisible()
    await page.getByLabel('Ich stimme ausdrücklich der Verarbeitung meiner Gesundheitsdaten gemäß Art. 9 DSGVO zu').check()

    const grantResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/consent/grant-health-data') && response.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Ich stimme zu' }).click()
    await grantResponsePromise

    await expect(page.getByTestId('consent-modal-health_data')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Notfall & Vorsorge' })).toBeVisible()

    await page.goto('/einstellungen')
    await expect(page.getByTestId('health-consent-toggle')).toBeChecked()

    const consentRecords = await getConsentRecords(unconsentedUserId, 'health_data')
    expect(consentRecords.length).toBeGreaterThan(0)
    expect(consentRecords[0].granted).toBe(true)
    expect(consentRecords[0].version).toBe(CONSENT_VERSION)

    const { data: profile } = await supabase
      .from('profiles')
      .select('health_data_consent_granted')
      .eq('id', unconsentedUserId)
      .single()
    expect(profile?.health_data_consent_granted).toBe(true)
  })

  test('does not fetch /api/notfall before consent and loads after grant', async ({ page }) => {
    await resetConsentLedger(unconsentedUserId, 'health_data')
    await upsertProfile(unconsentedUserId, unconsentedEmail, {
      health_data_consent_granted: false,
      health_data_consent_timestamp: null,
    })

    let notfallRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/api/notfall') && request.method() === 'GET') {
        notfallRequests += 1
      }
    })

    await page.goto('/notfall')
    await expect(page.getByTestId('consent-modal-health_data')).toBeVisible()
    await page.waitForTimeout(500)
    expect(notfallRequests).toBe(0)

    await page.getByLabel('Ich stimme ausdrücklich der Verarbeitung meiner Gesundheitsdaten gemäß Art. 9 DSGVO zu').check()

    const grantResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/consent/grant-health-data') && response.request().method() === 'POST'
    )
    const notfallResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/notfall') && response.request().method() === 'GET'
    )

    await page.getByRole('button', { name: 'Ich stimme zu' }).click()
    await grantResponsePromise
    const notfallResponse = await notfallResponsePromise

    expect(notfallResponse.ok()).toBe(true)
  })
})

test.describe('Privacy Policy Update Flow', () => {
  test.use({ storageState: storageStates.outdatedPolicy })

  test.beforeEach(async () => {
    await resetConsentLedger(outdatedPolicyUserId, 'privacy_policy')
    await insertConsent(outdatedPolicyUserId, 'privacy_policy', true, '0.9')
  })

  test('loads policy update for outdated users and accepts update', async ({ page }) => {
    await page.goto('/policy-update')

    const acceptButton = page.getByTestId('policy-update-accept')
    await expect(acceptButton).toBeDisabled()

    await page.getByTestId('policy-update-checkbox').check()
    await expect(acceptButton).toBeDisabled()

    await page.getByTestId('policy-update-content').evaluate((node) => {
      node.scrollTop = node.scrollHeight
      node.dispatchEvent(new Event('scroll'))
    })

    await expect(acceptButton).toBeEnabled()

    const acceptResponse = page.waitForResponse((response) =>
      response.url().includes('/api/consent/accept-privacy-policy') &&
      response.request().method() === 'POST'
    )
    await acceptButton.click()
    await acceptResponse

    await expect(page).toHaveURL(/\/dashboard/)

    const consentRecords = await getConsentRecords(outdatedPolicyUserId, 'privacy_policy')
    expect(consentRecords[0].version).toBe(PRIVACY_POLICY_VERSION)
  })

  test('shows error when policy acceptance fails', async ({ page }) => {
    await page.route('**/api/consent/accept-privacy-policy', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'request_failed' }),
      })
    })

    await page.goto('/policy-update')

    await page.getByTestId('policy-update-checkbox').check()
    await page.getByTestId('policy-update-content').evaluate((node) => {
      node.scrollTop = node.scrollHeight
      node.dispatchEvent(new Event('scroll'))
    })

    await page.getByTestId('policy-update-accept').click()
    await expect(page.getByText('Die Einwilligung konnte nicht gespeichert werden.')).toBeVisible()
  })
})

test.describe('Health Consent Withdrawal Flow', () => {
  test.use({ storageState: storageStates.consented })

  test('cancel then withdraw consent from settings', async ({ page }) => {
    await resetConsentLedger(consentedUserId, 'health_data')
    await insertConsent(consentedUserId, 'health_data', true, CONSENT_VERSION)
    await upsertProfile(consentedUserId, consentedEmail, {
      health_data_consent_granted: true,
      health_data_consent_timestamp: new Date().toISOString(),
    })

    const recordsBefore = await getConsentRecords(consentedUserId, 'health_data')

    await page.goto('/einstellungen')
    await expect(page.getByTestId('health-consent-toggle')).toBeChecked()
    await page.getByTestId('health-consent-toggle').click({ force: true })

    const dialog = page.getByTestId('health-consent-withdrawal-dialog')
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()

    await expect(page.getByTestId('health-consent-toggle')).toBeChecked()

    const recordsAfterCancel = await getConsentRecords(consentedUserId, 'health_data')
    expect(recordsAfterCancel.length).toBe(recordsBefore.length)

    await page.getByTestId('health-consent-toggle').click({ force: true })
    await expect(dialog).toBeVisible()

    await page.getByTestId('health-withdraw-confirm').check()
    const withdrawResponse = page.waitForResponse((response) =>
      response.url().includes('/api/consent/withdraw-health-data') &&
      response.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Einwilligung widerrufen' }).click()
    await withdrawResponse

    await expect(page.getByTestId('health-consent-toggle')).not.toBeChecked()

    const recordsAfterWithdraw = await getConsentRecords(consentedUserId, 'health_data')
    expect(recordsAfterWithdraw.length).toBeGreaterThan(recordsBefore.length)
    expect(recordsAfterWithdraw[0].granted).toBe(false)

    await page.goto('/notfall')
    await expect(page.getByTestId('consent-modal-health_data')).toBeVisible()
  })
})
