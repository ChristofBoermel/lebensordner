import { test as base } from '@playwright/test'

/**
 * Test fixtures for Family Dashboard tests
 * Provides mock data and authenticated states
 */

export type TestUser = {
  email: string
  password: string
  role: 'owner' | 'family_member'
  ownerTier?: 'basic' | 'premium'
}

export const testUsers: Record<string, TestUser> = {
  basicOwner: {
    email: 'owner-basic@test.com',
    password: 'Test123!',
    role: 'owner',
    ownerTier: 'basic',
  },
  premiumOwner: {
    email: 'owner-premium@test.com',
    password: 'Test123!',
    role: 'owner',
    ownerTier: 'premium',
  },
  familyBasic: {
    email: 'family-basic@test.com',
    password: 'Test123!',
    role: 'family_member',
    ownerTier: 'basic',
  },
  familyPremium: {
    email: 'family-premium@test.com',
    password: 'Test123!',
    role: 'family_member',
    ownerTier: 'premium',
  },
}

/**
 * Mock documents for testing
 */
export const mockDocuments = [
  {
    id: 'doc-1',
    title: 'Versicherungspolice',
    file_name: 'versicherung.pdf',
    file_size: 1024 * 1024, // 1MB
    file_type: 'application/pdf',
    category: 'versicherungen',
    created_at: new Date().toISOString(),
    notes: 'Wichtige Versicherungsunterlagen',
  },
  {
    id: 'doc-2',
    title: 'Testament',
    file_name: 'testament.pdf',
    file_size: 512 * 1024, // 512KB
    file_type: 'application/pdf',
    category: 'identitaet',
    created_at: new Date().toISOString(),
    notes: null,
  },
  {
    id: 'doc-3',
    title: 'Mietvertrag',
    file_name: 'mietvertrag.pdf',
    file_size: 2 * 1024 * 1024, // 2MB
    file_type: 'application/pdf',
    category: 'wohnen',
    created_at: new Date().toISOString(),
    notes: 'Ablauf: 31.12.2025',
  },
]

/**
 * Test fixture with authentication helper
 */
export const test = base.extend<{
  loginAs: (userType: keyof typeof testUsers) => Promise<void>
}>({
  loginAs: async ({ page }, use) => {
    await use(async (userType: keyof typeof testUsers) => {
      const user = testUsers[userType]
      await page.goto('/anmelden')
      await page.fill('[name="email"]', user.email)
      await page.fill('[name="password"]', user.password)
      await page.click('button[type="submit"]')
      
      // Wait for navigation based on role
      if (user.role === 'owner') {
        await page.waitForURL('/dashboard')
      } else {
        await page.waitForURL('/family')
      }
    })
  },
})
