import { expect, test } from '@playwright/test'
import { hasRequiredE2EEnv } from '../support/env'
import { createScenario } from '../support/harness'

test.describe('@smoke trusted person invite', () => {
  test.skip(!hasRequiredE2EEnv(), 'Supabase E2E environment variables are required')

  test('disables the invite button immediately and blocks duplicate submissions', async ({ page }) => {
    const scenario = createScenario('trusted-person-invite')

    try {
      const owner = await scenario.createUser({
        label: 'owner',
        fullName: 'E2E Owner Invite',
        tier: 'basic',
      })

      const pendingRelationship = await scenario.seedTrustedRelationship({
        ownerId: owner.id,
        trustedUserId: owner.id,
        trustedEmail: 'invite-target@example.com',
        trustedName: 'Invite Target',
        relationship: 'Freund',
        accessLevel: 'immediate',
        invitationStatus: 'pending',
        emailStatus: null,
        linked: false,
      })

      await scenario.authenticatePage(page, owner)

      let inviteRequests = 0
      await page.route('**/api/trusted-person/invite', async (route) => {
        inviteRequests += 1
        const response = await route.fetch()
        await new Promise((resolve) => setTimeout(resolve, 800))
        await route.fulfill({ response })
      })

      await page.goto('/zugriff')

      const inviteButton = page.getByTestId(
        `trusted-person-invite-${pendingRelationship.trustedPersonId}`,
      )

      await inviteButton.click()
      await expect(inviteButton).toBeDisabled()
      await expect(inviteButton).toContainText('Wird gesendet')

      await expect
        .poll(() => inviteRequests, { message: 'only one invite request should be sent' })
        .toBe(1)

      await expect
        .poll(
          async () => {
            const sentStatus = page.getByTestId(
              `trusted-person-status-${pendingRelationship.trustedPersonId}`,
            )

            if (await sentStatus.count()) {
              return (await sentStatus.textContent())?.trim() ?? ''
            }

            if (await inviteButton.count()) {
              return (await inviteButton.textContent())?.trim() ?? ''
            }

            return ''
          },
          {
            message:
              'invite row should settle into either a sent badge or an actionable retry state',
            timeout: 15000,
          },
        )
        .toMatch(/Einladung gesendet|Einladen/)

      await expect
        .poll(() => inviteRequests, { message: 'a second click must not trigger another invite request' })
        .toBe(1)
    } finally {
      await scenario.cleanup()
    }
  })
})
