import { test, expect } from '@playwright/test'

/**
 * Family Dashboard E2E Tests (Mocked)
 */

test.describe('Family Dashboard | Basic Owner Mock', () => {
    test.beforeEach(async ({ page }) => {
        // Intercept Supabase Auth
        await page.route('**/auth/v1/user', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'member-123',
                    email: 'family@test.com',
                    user_metadata: { full_name: 'Family Member' },
                }),
            })
        })

        // Intercept Trusted Persons (Relationship)
        await page.route('**/rest/v1/trusted_persons*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'tp-1',
                        user_id: 'owner-123',
                        linked_user_id: 'member-123',
                        role: 'family_member',
                        invitation_status: 'accepted',
                        is_active: true,
                        access_level: 'immediate',
                    }
                ]),
            })
        })

        // Intercept Owner Profile (Subscription Tier: Basic)
        await page.route('**/rest/v1/profiles?id=eq.owner-123*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'owner-123',
                        subscription_status: 'active',
                        stripe_price_id: 'price_basic_monthly',
                    }
                ]),
            })
        })

        // Intercept Documents
        await page.route('**/rest/v1/documents*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'doc-1',
                        title: 'Test Document',
                        category: 'identitaet',
                        user_id: 'owner-123',
                        created_at: new Date().toISOString(),
                    }
                ]),
            })
        })

        await page.goto('/family?ownerId=owner-123')
    })

    test('should display documents but disable download and show notice', async ({ page }) => {
        await expect(page.locator('text=Test Document')).toBeVisible()

        // Check for premium notice
        await expect(page.locator('text=Premium-Funktion')).toBeVisible()

        // Check for disabled download in the list item
        const downloadBtn = page.locator('button[aria-label="Dokument herunterladen"]').first()
        await expect(downloadBtn).toBeDisabled()
    })

    test('Senior Mode: Touch targets should be accessible', async ({ page }) => {
        // Selection mode button
        const selectBtn = page.locator('button:has-text("Mehrere auswählen")')
        const box = await selectBtn.boundingBox()
        expect(box?.height).toBeGreaterThanOrEqual(44)

        await selectBtn.click()

        // Checklist checkbox
        const checkbox = page.locator('[data-testid="document-checkbox"]').first()
        const checkboxBox = await checkbox.boundingBox()
        expect(checkboxBox?.width).toBeGreaterThanOrEqual(44)
    })
})

test.describe('Family Dashboard | Premium Owner Mock', () => {
    test.beforeEach(async ({ page }) => {
        // Intercept Auth...
        await page.route('**/auth/v1/user', async (route) => {
            await route.fulfill({ status: 200, body: JSON.stringify({ id: 'member-123', email: 'family@test.com' }) })
        })

        // Intercept Relationship
        await page.route('**/rest/v1/trusted_persons*', async (route) => {
            await route.fulfill({ status: 200, body: JSON.stringify([{ role: 'family_member', user_id: 'owner-456' }]) })
        })

        // Intercept Premium Profile
        await page.route('**/rest/v1/profiles?id=eq.owner-456*', async (route) => {
            await route.fulfill({ status: 200, body: JSON.stringify([{ subscription_status: 'active', stripe_price_id: 'price_premium' }]) })
        })

        // Intercept Documents
        await page.route('**/rest/v1/documents*', async (route) => {
            await route.fulfill({
                status: 200, body: JSON.stringify([
                    { id: 'pdoc-1', title: 'Premium Doc', category: 'wohnen' },
                    { id: 'pdoc-2', title: 'Other Doc', category: 'wohnen' }
                ])
            })
        })

        await page.goto('/family?ownerId=owner-456')
    })

    test('should allow single and batch downloads', async ({ page }) => {
        // Single download enabled
        const downloadBtn = page.locator('button[aria-label="Dokument herunterladen"]').first()
        await expect(downloadBtn).toBeEnabled()

        // ZIP download enabled in batch mode
        await page.click('button:has-text("Mehrere auswählen")')
        await page.locator('[data-testid="document-checkbox"]').first().click()
        await page.locator('[data-testid="document-checkbox"]').nth(1).click()

        await expect(page.locator('button:has-text("ZIP herunterladen")')).toBeEnabled()
    })

    test('200% Zoom Stability', async ({ page }) => {
        await page.evaluate(() => {
            document.body.style.zoom = '200%'
        })

        // Header should still be visible and not layout-shifted catastrophically
        await expect(page.locator('h1')).toBeVisible()
        await expect(page.locator('text=Premium Doc')).toBeVisible()
    })
})
