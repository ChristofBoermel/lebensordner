import { expect, test, type Page } from '@playwright/test'
import { hasRequiredE2EEnv } from '../support/env'
import { createScenario } from '../support/harness'

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

async function openDocumentActions(page: Page, documentId: string) {
  await page.getByTestId(`document-actions-${documentId}`).click()
}

async function enableExtraSecurity(page: Page, documentId: string, passphrase: string) {
  await openDocumentActions(page, documentId)
  await page.getByRole('menuitem', { name: 'Extra-Sicherheit aktivieren' }).click()
  if (await unlockVaultIfPrompted(page, passphrase)) {
    await openDocumentActions(page, documentId)
    await page.getByRole('menuitem', { name: 'Extra-Sicherheit aktivieren' }).click()
  }
}

async function disableExtraSecurity(page: Page, documentId: string, passphrase: string) {
  const removeAction = page.getByRole('menuitem', { name: 'Extra-Sicherheit entfernen' })
  const isAlreadyOpen = await removeAction.isVisible({ timeout: 1500 }).catch(() => false)
  if (!isAlreadyOpen) {
    await openDocumentActions(page, documentId)
  }
  await removeAction.click()
  if (await unlockVaultIfPrompted(page, passphrase)) {
    await openDocumentActions(page, documentId)
    await page.getByRole('menuitem', { name: 'Extra-Sicherheit entfernen' }).click()
  }
}

test.describe('@smoke document lock and unlock', () => {
  test.skip(!hasRequiredE2EEnv(), 'Supabase E2E environment variables are required')

  test('locks and unlocks a document through the real UI', async ({ page }) => {
    test.setTimeout(60_000)
    const scenario = createScenario('document-lock')

    try {
      const owner = await scenario.createUser({
        label: 'owner',
        fullName: 'E2E Lock Owner',
        tier: 'basic',
        withVault: true,
      })
      const document = await scenario.seedDocument({
        ownerId: owner.id,
        title: 'Sicherheitsdokument',
      })

      await scenario.authenticatePage(page, owner, {
        vaultPassphrase: owner.vaultPassphrase,
      })
      await page.goto('/dokumente?kategorie=identitaet')

      await enableExtraSecurity(page, document.id, owner.vaultPassphrase!)
      const row = page.getByTestId(`document-row-${document.id}`)
      await expect(row.getByText('Gesichert')).toBeVisible({ timeout: 15000 })

      await disableExtraSecurity(page, document.id, owner.vaultPassphrase!)

      await openDocumentActions(page, document.id)
      await expect(page.getByRole('menuitem', { name: 'Extra-Sicherheit aktivieren' })).toBeVisible({ timeout: 15000 })
    } finally {
      await scenario.cleanup()
    }
  })
})
