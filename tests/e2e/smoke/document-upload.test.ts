import { expect, test } from '@playwright/test'
import { hasRequiredE2EEnv } from '../support/env'
import { createScenario } from '../support/harness'

function pdfUpload(name: string, body: string) {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4\n${body}\n%%EOF`, 'utf-8'),
  }
}

test.describe('@smoke document upload flows', () => {
  test.skip(!hasRequiredE2EEnv(), 'Supabase E2E environment variables are required')

  test('uploads a document through the real UI', async ({ page }) => {
    const scenario = createScenario('document-upload')

    try {
      const owner = await scenario.createUser({
        label: 'owner',
        fullName: 'E2E Upload Owner',
        tier: 'basic',
        withVault: true,
      })

      await scenario.authenticatePage(page, owner, {
        vaultPassphrase: owner.vaultPassphrase,
      })
      await page.goto('/dokumente?upload=true&kategorie=identitaet')

      await expect(page.getByTestId('upload-dialog')).toBeVisible()
      await page.getByTestId('file-upload-input').setInputFiles(
        pdfUpload('lebenslauf.pdf', 'Upload smoke test'),
      )
      await page.getByLabel('Titel').fill('E2E Upload Dokument')
      await page.getByRole('button', { name: 'Hinzufügen' }).click()

      await expect(
        page.getByText('✅ "E2E Upload Dokument" hochgeladen', { exact: true }),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid^="document-row-"]').filter({
          has: page.getByText('E2E Upload Dokument', { exact: true }),
        }),
      ).toHaveCount(1)
    } finally {
      await scenario.cleanup()
    }
  })

  test('uploads a document into an existing subcategory', async ({ page }) => {
    const scenario = createScenario('document-upload-subcategory')

    try {
      const owner = await scenario.createUser({
        label: 'owner',
        fullName: 'E2E Folder Owner',
        tier: 'basic',
        withVault: true,
      })
      const subcategory = await scenario.seedSubcategory({
        ownerId: owner.id,
        parentCategory: 'identitaet',
        name: 'Wichtige Ausweise',
      })

      await scenario.authenticatePage(page, owner, {
        vaultPassphrase: owner.vaultPassphrase,
      })
      await page.goto('/dokumente?upload=true&kategorie=identitaet')

      await page.getByTestId('file-upload-input').setInputFiles(
        pdfUpload('personalausweis.pdf', 'Subcategory smoke test'),
      )
      await page.getByTestId('upload-subcategory-select').selectOption(subcategory.id)
      await page.getByLabel('Titel').fill('Ausweis im Unterordner')
      await page.getByRole('button', { name: 'Hinzufügen' }).click()

      await expect(
        page.getByText('✅ "Ausweis im Unterordner" hochgeladen', { exact: true }),
      ).toBeVisible()
      await expect
        .poll(async () => {
          const uploaded = await scenario.findDocumentByTitle({
            ownerId: owner.id,
            title: 'Ausweis im Unterordner',
          })
          return uploaded?.subcategory_id ?? null
        })
        .toBe(subcategory.id)
    } finally {
      await scenario.cleanup()
    }
  })
})
