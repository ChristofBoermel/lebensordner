import { test, expect } from '@playwright/test'

test.describe('Family Dashboard - Basic Owner', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family member
    await page.goto('/anmelden')
    await page.fill('[name="email"]', 'family@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/family')
  })

  test('should display documents but disable download for basic owner', async ({ page }) => {
    // Documents should be visible
    await expect(page.locator('text=Dokumente')).toBeVisible()
    await expect(page.locator('[data-testid="document-card"]').first()).toBeVisible()

    // Download button should be disabled
    const downloadButton = page.locator('button:has-text("Download nicht verfügbar")').first()
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toBeDisabled()

    // Tooltip should show premium requirement
    await downloadButton.hover()
    await expect(page.locator('text=Download mit Premium verfügbar')).toBeVisible()

    // View button should work
    const viewButton = page.locator('button:has-text("Dokument ansehen")').first()
    await expect(viewButton).toBeEnabled()
  })

  test('should show premium upgrade notice', async ({ page }) => {
    await expect(page.locator('text=Eingeschränkter Zugriff')).toBeVisible()
    await expect(page.locator('text=Download erfordert ein Premium-Abonnement')).toBeVisible()
  })
})

test.describe('Family Dashboard - Premium Owner', () => {
  test.beforeEach(async ({ page }) => {
    // Login as family member of premium owner
    await page.goto('/anmelden')
    await page.fill('[name="email"]', 'family-premium@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/family')
  })

  test('should allow single document download', async ({ page }) => {
    const downloadButton = page.locator('button:has-text("Herunterladen")').first()
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toBeEnabled()

    // Click download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click(),
    ])

    expect(download.suggestedFilename()).toBeTruthy()
  })

  test('should allow ZIP download with multi-select', async ({ page }) => {
    // Enable selection mode
    await page.click('button:has-text("Mehrere auswählen")')

    // Select multiple documents
    await page.locator('[data-testid="document-checkbox"]').first().check()
    await page.locator('[data-testid="document-checkbox"]').nth(1).check()

    // ZIP download button should appear
    const zipButton = page.locator('button:has-text("ZIP herunterladen")')
    await expect(zipButton).toBeVisible()

    // Click ZIP download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      zipButton.click(),
    ])

    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('should not show premium notice for premium owners', async ({ page }) => {
    await expect(page.locator('text=Eingeschränkter Zugriff')).not.toBeVisible()
  })
})

test.describe('Owner Access', () => {
  test('should redirect owner to dashboard', async ({ page }) => {
    await page.goto('/anmelden')
    await page.fill('[name="email"]', 'owner@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Owner should be redirected to dashboard, not family
    await page.waitForURL('/dashboard')
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('should block owner from accessing family route', async ({ page }) => {
    // Login as owner
    await page.goto('/anmelden')
    await page.fill('[name="email"]', 'owner@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Try to access family route
    await page.goto('/family')

    // Should redirect back to dashboard
    await page.waitForURL('/dashboard')
  })
})

test.describe('Family Dashboard - Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/anmelden')
    await page.fill('[name="email"]', 'family@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/family')

    // Check ARIA labels on buttons
    await expect(page.locator('button[aria-label="Dokument ansehen"]').first()).toBeVisible()
    await expect(page.locator('button[aria-label="Dokument herunterladen"]').first()).toBeVisible()
  })

  test('should work with 200% zoom', async ({ page }) => {
    await page.goto('/anmelden')
    await page.fill('[name="email"]', 'family@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/family')

    // Set zoom to 200%
    await page.evaluate(() => {
      document.body.style.zoom = '200%'
    })

    // Layout should not break
    const documentCard = page.locator('[data-testid="document-card"]').first()
    const box = await documentCard.boundingBox()
    expect(box?.width).toBeGreaterThan(0)
    expect(box?.height).toBeGreaterThan(0)
  })
})
