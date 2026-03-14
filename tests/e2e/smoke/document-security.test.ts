import { expect, test, type Page } from '@playwright/test'
import { hasRequiredE2EEnv } from '../support/env'
import { createScenario } from '../support/harness'

async function unlockVaultIfPrompted(page: Page, passphrase: string) {
  const unlockDialog = page.getByRole('dialog').filter({ hasText: /Tresor entsperren/i })
  const dialogVisible = await unlockDialog.isVisible({ timeout: 1500 }).catch(() => false)
  if (!dialogVisible) {
    return false
  }

  await page.getByLabel('Passwort').fill(passphrase)
  await page.getByRole('button', { name: 'Entsperren' }).click()
  await expect(unlockDialog).toBeHidden({ timeout: 15000 })
  return true
}

async function enableExtraSecurity(page: Page, documentId: string, passphrase: string) {
  await page.getByTestId(`document-actions-${documentId}`).click()
  await page.getByRole('menuitem', { name: 'Extra-Sicherheit aktivieren' }).click()
  if (await unlockVaultIfPrompted(page, passphrase)) {
    await page.getByTestId(`document-actions-${documentId}`).click()
    await page.getByRole('menuitem', { name: 'Extra-Sicherheit aktivieren' }).click()
  }
}

async function disableExtraSecurity(page: Page, documentId: string, passphrase: string) {
  await page.getByTestId(`document-actions-${documentId}`).click()
  await page.getByRole('menuitem', { name: 'Extra-Sicherheit entfernen' }).click()
  if (await unlockVaultIfPrompted(page, passphrase)) {
    await page.getByTestId(`document-actions-${documentId}`).click()
    await page.getByRole('menuitem', { name: 'Extra-Sicherheit entfernen' }).click()
  }
}

test.describe('@smoke document lock and unlock', () => {
  test.skip(!hasRequiredE2EEnv(), 'Supabase E2E environment variables are required')

  test('locks and unlocks a document through the real UI', async ({ page }) => {
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

      await page.getByTestId(`document-actions-${document.id}`).click()
      await expect(page.getByRole('menuitem', { name: 'Extra-Sicherheit entfernen' })).toBeVisible({ timeout: 15000 })
      await page.keyboard.press('Escape')

      await disableExtraSecurity(page, document.id, owner.vaultPassphrase!)

      await page.getByTestId(`document-actions-${document.id}`).click()
      await expect(page.getByRole('menuitem', { name: 'Extra-Sicherheit aktivieren' })).toBeVisible({ timeout: 15000 })
      await page.keyboard.press('Escape')
    } finally {
      await scenario.cleanup()
    }
  })
})
