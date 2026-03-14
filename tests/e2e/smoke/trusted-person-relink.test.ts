import { expect, test, type Browser, type Page } from '@playwright/test'
import { hasRequiredE2EEnv } from '../support/env'
import { createScenario } from '../support/harness'

const TEST_OTP = '123456'

async function unlockVaultIfPrompted(page: Page, passphrase: string) {
  const unlockDialog = page.getByRole('dialog').filter({ hasText: /Tresor entsperren/i })
  const dialogVisible = await unlockDialog.isVisible({ timeout: 1500 }).catch(() => false)
  if (!dialogVisible) {
    return false
  }

  let lastError: unknown = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const passwordInput = page.getByLabel('Passwort').last()
      await expect(passwordInput).toBeVisible({ timeout: 5000 })
      await passwordInput.fill(passphrase, { timeout: 5000 })

      const unlockButton = page.getByRole('button', { name: 'Entsperren' }).last()
      await expect(unlockButton).toBeVisible({ timeout: 5000 })
      await unlockButton.click({ timeout: 5000 })
      await expect(unlockDialog).toBeHidden({ timeout: 15000 })
      return true
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Vault unlock dialog could not be completed')
}

async function loginFromCurrentPage(page: Page, email: string, password: string) {
  const cookieButton = page.getByRole('button', { name: /Nur notwendige|Alle akzeptieren/i }).first()
  if (await cookieButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieButton.click()
  }

  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible({ timeout: 15000 })
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
}

async function createAuthenticatedPage(browser: Browser) {
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()
  return { context, page }
}

test.describe('@smoke trusted person remove and relink lifecycle', () => {
  test.skip(!hasRequiredE2EEnv(), 'Supabase E2E environment variables are required')

  test('removing and re-adding the same trusted user behaves like a fresh secure relationship', async ({ browser }) => {
    test.setTimeout(180_000)
    const scenario = createScenario('trusted-person-relink')

    const { context: ownerContext, page: ownerPage } = await createAuthenticatedPage(browser)
    const { context: trustedContext, page: trustedPage } = await createAuthenticatedPage(browser)
    const { context: redeemContext, page: redeemPage } = await createAuthenticatedPage(browser)

    try {
      const owner = await scenario.createUser({
        label: 'owner',
        fullName: 'E2E Relink Owner',
        tier: 'basic',
        withVault: true,
      })
      const trusted = await scenario.createUser({
        label: 'trusted',
        fullName: 'E2E Relink Trusted',
        tier: 'basic',
      })

      const initialRelationship = await scenario.seedTrustedRelationship({
        ownerId: owner.id,
        trustedUserId: trusted.id,
        trustedEmail: trusted.email,
        trustedName: trusted.fullName,
        accessLevel: 'immediate',
        invitationStatus: 'accepted',
        emailStatus: 'sent',
      })
      await scenario.seedRelationshipKey({
        ownerId: owner.id,
        trustedPersonId: initialRelationship.trustedPersonId,
        ownerPassphrase: owner.vaultPassphrase!,
        relationshipKey: initialRelationship.relationshipKey,
      })

      const sharedDocument = await scenario.seedDocument({
        ownerId: owner.id,
        title: 'Relink Lebensordner Dokument',
      })
      await scenario.shareDocument({
        ownerId: owner.id,
        trustedPersonId: initialRelationship.trustedPersonId,
        documentId: sharedDocument.id,
        permission: 'download',
      })

      await scenario.authenticatePage(ownerPage, owner, {
        vaultPassphrase: owner.vaultPassphrase,
      })
      await scenario.authenticatePage(trustedPage, trusted, {
        relationshipKeyByOwnerId: {
          [owner.id]: initialRelationship.relationshipKey,
        },
      })

      await trustedPage.goto('/zugriff?tab=mein-zugriff')
      await expect(trustedPage.getByText('Verbindung hergestellt').first()).toBeVisible({ timeout: 15000 })

      await trustedPage.goto('/vp-dashboard/view/' + owner.id)
      await expect(trustedPage.getByText(sharedDocument.title)).toBeVisible({ timeout: 15000 })

      ownerPage.once('dialog', async (dialog) => {
        await dialog.accept()
      })
      await ownerPage.goto('/zugriff')
      const initialCard = ownerPage.getByTestId(
        'trusted-person-card-' + initialRelationship.trustedPersonId,
      )
      await expect(initialCard).toBeVisible({ timeout: 15000 })
      await initialCard.getByTitle('Löschen').click()
      await expect(initialCard).toHaveCount(0, { timeout: 15000 })

      await trustedPage.goto('/zugriff?tab=mein-zugriff')
      await expect(trustedPage.getByText('Keine Verbindungen vorhanden.')).toBeVisible({ timeout: 15000 })

      await trustedPage.goto('/vp-dashboard/view/' + owner.id)
      await expect(trustedPage.getByText('Keine Berechtigung für diese Ansicht')).toBeVisible({ timeout: 15000 })
      await expect(trustedPage.getByText(sharedDocument.title)).toHaveCount(0)

      const reinvitedSeed = await scenario.seedTrustedRelationship({
        ownerId: owner.id,
        trustedUserId: trusted.id,
        trustedEmail: trusted.email,
        trustedName: trusted.fullName,
        relationship: 'Tochter',
        accessLevel: 'immediate',
        invitationStatus: 'pending',
        emailStatus: null,
        linked: false,
      })

      await ownerPage.goto('/zugriff')
      const reinvited = await scenario.getTrustedPersonByEmail({
        ownerId: owner.id,
        trustedEmail: trusted.email,
      })
      if (!reinvited || reinvited.id !== reinvitedSeed.trustedPersonId) {
        throw new Error('Trusted person row was not recreated after reseeding the pending relationship')
      }

      const reinvitedCard = ownerPage.getByTestId('trusted-person-card-' + reinvited.id)
      await expect(reinvitedCard).toBeVisible({ timeout: 15000 })
      await scenario.resetTrustedPersonInviteRateLimitState(owner.id)
      await expect(async () => {
        const inviteResponsePromise = ownerPage.waitForResponse((response) => {
          return (
            response.url().includes('/api/trusted-person/invite') &&
            response.request().method() === 'POST'
          )
        }, { timeout: 3000 })

        await reinvitedCard.getByRole('button', { name: /^Einladen$/i }).click()
        const inviteResponse = await inviteResponsePromise
        if (!inviteResponse.ok()) {
          throw new Error(`Invite request failed with ${inviteResponse.status()}: ${await inviteResponse.text()}`)
        }
      }).toPass({ timeout: 15000 })

      await expect.poll(async () => {
        const person = await scenario.getTrustedPersonByEmail({
          ownerId: owner.id,
          trustedEmail: trusted.email,
        })
        return person?.invitation_token ?? null
      }, { timeout: 15000 }).not.toBeNull()

      const invitedPerson = await scenario.getTrustedPersonByEmail({
        ownerId: owner.id,
        trustedEmail: trusted.email,
      })
      if (!invitedPerson?.invitation_token) {
        throw new Error('Invitation token was not created for the reinvited trusted user')
      }

      await trustedPage.goto('/einladung/' + invitedPerson.invitation_token)
      await trustedPage.getByRole('button', { name: /^Annehmen$/i }).click()
      await expect(trustedPage.getByText('Einladung angenommen!')).toBeVisible({ timeout: 15000 })

      await ownerPage.goto('/zugriff')
      await expect(reinvitedCard.getByRole('button', { name: /Sicheren Link erstellen/i })).toBeVisible({ timeout: 15000 })
      await reinvitedCard.getByRole('button', { name: /Sicheren Link erstellen/i }).click()
      await unlockVaultIfPrompted(ownerPage, owner.vaultPassphrase!)

      const setupDialog = ownerPage.getByRole('dialog').filter({ hasText: /Sicherer Zugriffslink erstellt/i })
      await expect(setupDialog).toBeVisible({ timeout: 15000 })
      await setupDialog.getByRole('button', { name: /Kopieren/i }).click()
      const setupUrl = await ownerPage.evaluate(async () => navigator.clipboard.readText())
      if (!setupUrl || !setupUrl.includes('/api/trusted-access/invitations/redeem?token=')) {
        throw new Error('Setup link URL was not copied correctly from the owner dialog')
      }

      await redeemPage.goto(setupUrl)
      await redeemPage.waitForURL(/\/anmelden(\?next=|$)/, { timeout: 15000 })
      await loginFromCurrentPage(redeemPage, trusted.email, trusted.password)
      await redeemPage.waitForURL(/\/zugriff\/access\/redeem/, { timeout: 30000 })

      await expect(redeemPage.getByRole('heading', { name: /Sicherer Dokumentenzugang/i })).toBeVisible({ timeout: 15000 })
      await redeemPage.getByRole('button', { name: /Code per E-Mail senden/i }).click()
      await expect.poll(async () => {
        const invitation = await scenario.getLatestTrustedAccessInvitation({
          trustedPersonId: reinvited.id,
        })
        return invitation?.id ?? null
      }, { timeout: 15000 }).not.toBeNull()

      const latestInvitation = await scenario.getLatestTrustedAccessInvitation({
        trustedPersonId: reinvited.id,
      })
      if (!latestInvitation) {
        throw new Error('Trusted access invitation was not created for the setup link')
      }

      await expect.poll(async () => {
        try {
          await scenario.setLatestTrustedAccessOtp({
            invitationId: latestInvitation.id,
            otp: TEST_OTP,
          })
          return true
        } catch {
          return false
        }
      }, { timeout: 15000 }).toBe(true)

      await redeemPage.getByPlaceholder('6-stelliger Code').fill(TEST_OTP)
      await redeemPage.getByRole('button', { name: /Code bestaetigen/i }).click()
      await expect(redeemPage.getByText(/Code bestaetigt/i)).toBeVisible({ timeout: 15000 })
      await redeemPage.getByRole('button', { name: /Diesen Browser einrichten/i }).click()
      await redeemPage.waitForURL(/\/zugriff(\?tab=mein-zugriff)?$/, { timeout: 30000 })

      await expect(redeemPage.getByText('Verbindung hergestellt').first()).toBeVisible({ timeout: 15000 })
      await expect(redeemPage.getByText(/Warten auf Freigaben des Besitzers/i)).toBeVisible({ timeout: 15000 })

      await redeemPage.goto('/vp-dashboard/view/' + owner.id)
      await expect(redeemPage.getByTestId('trusted-person-empty-state')).toContainText(
        'Es wurden noch keine Dokumente für Sie freigegeben.',
      )

      await scenario.shareDocument({
        ownerId: owner.id,
        trustedPersonId: reinvited.id,
        documentId: sharedDocument.id,
        permission: 'download',
      })

      await redeemPage.goto('/zugriff?tab=mein-zugriff')
      await expect(redeemPage.getByText('Verbindung hergestellt').first()).toBeVisible({ timeout: 15000 })
      await expect(redeemPage.getByText(/1 Dokument verfuegbar|1 Dokument verfügbar/i)).toBeVisible({ timeout: 15000 })

      await redeemPage.goto('/vp-dashboard/view/' + owner.id)
      await expect(redeemPage.getByText(sharedDocument.title)).toBeVisible({ timeout: 15000 })
      await expect(redeemPage.getByTestId('download-all-documents')).toBeVisible({ timeout: 15000 })
    } finally {
      await ownerContext.close()
      await trustedContext.close()
      await redeemContext.close()
      await scenario.cleanup()
    }
  })
})
