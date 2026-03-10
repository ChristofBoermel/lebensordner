import { expect, test } from '@playwright/test'
import { hasRequiredE2EEnv } from '../support/env'
import { createScenario } from '../support/harness'

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

      await page.getByTestId(`document-actions-${document.id}`).click()
      await page.getByRole('menuitem', { name: 'Extra-Sicherheit aktivieren' }).click()

      const row = page.getByTestId(`document-row-${document.id}`)
      await expect
        .poll(async () => (await row.textContent()) ?? '', {
          message: 'document row should show the secured badge after enabling extra security',
          timeout: 15000,
        })
        .toContain('Gesichert')

      await page.getByTestId(`document-actions-${document.id}`).click()
      await page.getByRole('menuitem', { name: 'Extra-Sicherheit entfernen' }).click()
      await expect(row.getByText('Gesichert')).toHaveCount(0)
    } finally {
      await scenario.cleanup()
    }
  })
})
