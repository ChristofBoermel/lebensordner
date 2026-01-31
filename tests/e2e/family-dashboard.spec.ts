import { test, expect } from '@playwright/test'

/**
 * Family Dashboard E2E Tests
 * Kritische Pfade für Family Member Zugriff absichern
 */

// Testdaten - Minimal, keine externen Abhängigkeiten
const testUsers = {
  familyBasic: {
    email: 'family.basic@test.com',
    password: 'TestPass123!',
    ownerTier: 'basic',
  },
  familyPremium: {
    email: 'family.premium@test.com',
    password: 'TestPass123!',
    ownerTier: 'premium',
  },
  owner: {
    email: 'owner@test.com',
    password: 'TestPass123!',
  },
}

test.describe('Family Dashboard | Basic Owner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/anmelden')
    await page.fill('[name="email"]', testUsers.familyBasic.email)
    await page.fill('[name="password"]', testUsers.familyBasic.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/family')
  })

  test('/family lädt und Dokumente sind sichtbar', async ({ page }) => {
    // Page loaded
    await expect(page.locator('h1')).toContainText('Dokumente')
    
    // Documents visible
    const documentCards = page.locator('[data-testid="document-card"]')
    await expect(documentCards.first()).toBeVisible()
  })

  test('Download ist disabled für Basic Owner', async ({ page }) => {
    // Disabled download button
    const downloadButton = page.locator('button:has-text("Download nicht verfügbar")').first()
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toBeDisabled()

    // Premium tooltip
    await downloadButton.hover()
    await expect(page.locator('text=Download mit Premium verfügbar')).toBeVisible()
  })

  test('Mobile (375px): Layout funktioniert', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Reload to trigger mobile layout
    await page.reload()
    await page.waitForURL('/family')

    // Check document card fits in viewport
    const card = page.locator('[data-testid="document-card"]').first()
    const box = await card.boundingBox()
    
    expect(box?.width).toBeLessThanOrEqual(375)
    expect(box?.width).toBeGreaterThan(300)
  })
})

test.describe('Family Dashboard | Premium Owner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/anmelden')
    await page.fill('[name="email"]', testUsers.familyPremium.email)
    await page.fill('[name="password"]', testUsers.familyPremium.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/family')
  })

  test('Einzel-Download ist möglich', async ({ page }) => {
    const downloadButton = page.locator('button:has-text("Herunterladen")').first()
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toBeEnabled()

    // Click triggers download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click(),
    ])

    expect(download.suggestedFilename()).toBeTruthy()
  })

  test('ZIP-Download ist möglich mit Multi-Select', async ({ page }) => {
    // Enable selection mode
    await page.click('button:has-text("Mehrere auswählen")')

    // Select documents
    await page.locator('[data-testid="document-checkbox"]').first().check()
    await page.locator('[data-testid="document-checkbox"]').nth(1).check()

    // ZIP download button appears
    const zipButton = page.locator('button:has-text("ZIP herunterladen")')
    await expect(zipButton).toBeVisible()
    await expect(zipButton).toBeEnabled()

    // Download ZIP
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      zipButton.click(),
    ])

    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('Mobile (375px): Multi-Select funktioniert', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await page.waitForURL('/family')

    // Selection mode button visible and clickable
    const selectButton = page.locator('button:has-text("Mehrere auswählen")')
    await expect(selectButton).toBeVisible()
    
    await selectButton.click()
    
    // Checkboxes visible
    const checkbox = page.locator('[data-testid="document-checkbox"]').first()
    await expect(checkbox).toBeVisible()
    
    // Checkbox tappable (44px min)
    const box = await checkbox.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('Owner | Export-Bereich unverändert', () => {
  test('Owner wird zu Dashboard redirected', async ({ page }) => {
    await page.goto('/anmelden')
    await page.fill('[name="email"]', testUsers.owner.email)
    await page.fill('[name="password"]', testUsers.owner.password)
    await page.click('button[type="submit"]')

    // Redirected to dashboard, not family
    await page.waitForURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('Owner kann /family nicht direkt aufrufen', async ({ page }) => {
    // Login as owner
    await page.goto('/anmelden')
    await page.fill('[name="email"]', testUsers.owner.email)
    await page.fill('[name="password"]', testUsers.owner.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Try accessing family route
    await page.goto('/family')

    // Redirected back to dashboard
    await page.waitForURL('/dashboard')
  })

  test('Export-Bereich für Owner verfügbar', async ({ page }) => {
    await page.goto('/anmelden')
    await page.fill('[name="email"]', testUsers.owner.email)
    await page.fill('[name="password"]', testUsers.owner.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Navigate to export section
    await page.click('a:has-text("Export")')
    await page.waitForURL('**/export')

    // Export functionality available
    await expect(page.locator('button:has-text("ZIP Export")')).toBeVisible()
    await expect(page.locator('button:has-text("ZIP Export")')).toBeEnabled()
  })
})
