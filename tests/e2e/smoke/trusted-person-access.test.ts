import { expect, test } from '@playwright/test'
import { hasRequiredE2EEnv } from '../support/env'
import { createScenario } from '../support/harness'

test.describe('@smoke trusted person access scope', () => {
  test.skip(!hasRequiredE2EEnv(), 'Supabase E2E environment variables are required')

  test('shows an empty state and no bulk download when nothing is explicitly shared', async ({ page }) => {
    const scenario = createScenario('trusted-person-empty')

    try {
      const owner = await scenario.createUser({
        label: 'owner',
        fullName: 'E2E Owner Empty',
        tier: 'basic',
        withVault: true,
      })
      const trusted = await scenario.createUser({
        label: 'trusted',
        fullName: 'E2E Trusted Empty',
        tier: 'basic',
      })

      await scenario.seedTrustedRelationship({
        ownerId: owner.id,
        trustedUserId: trusted.id,
        trustedEmail: trusted.email,
        trustedName: trusted.fullName,
        accessLevel: 'immediate',
        invitationStatus: 'accepted',
        emailStatus: 'sent',
      })

      await scenario.authenticatePage(page, trusted)
      await page.goto(`/vp-dashboard/view/${owner.id}`)

      await expect(page.getByTestId('trusted-person-empty-state')).toContainText(
        'Es wurden noch keine Dokumente für Sie freigegeben.',
      )
      await expect(page.getByTestId('download-all-documents')).toHaveCount(0)
    } finally {
      await scenario.cleanup()
    }
  })

  test('renders only explicitly shared documents and keeps bulk download scoped to those shares', async ({ page }) => {
    const scenario = createScenario('trusted-person-shared')

    try {
      const owner = await scenario.createUser({
        label: 'owner',
        fullName: 'E2E Owner Shared',
        tier: 'premium',
        withVault: true,
      })
      const trusted = await scenario.createUser({
        label: 'trusted',
        fullName: 'E2E Trusted Shared',
        tier: 'basic',
      })

      const relationship = await scenario.seedTrustedRelationship({
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
        trustedPersonId: relationship.trustedPersonId,
        ownerPassphrase: owner.vaultPassphrase!,
        relationshipKey: relationship.relationshipKey,
      })

      const sharedDoc = await scenario.seedDocument({
        ownerId: owner.id,
        title: 'Nur dieses Dokument ist freigegeben',
      })
      await scenario.seedDocument({
        ownerId: owner.id,
        title: 'Dieses Dokument darf nicht sichtbar sein',
      })
      await scenario.shareDocument({
        ownerId: owner.id,
        trustedPersonId: relationship.trustedPersonId,
        documentId: sharedDoc.id,
        permission: 'download',
      })

      await scenario.authenticatePage(page, trusted, {
        relationshipKeyByOwnerId: {
          [owner.id]: relationship.relationshipKey,
        },
      })
      await page.goto(`/vp-dashboard/view/${owner.id}`)

      await expect(page.getByText(sharedDoc.title)).toBeVisible()
      await expect(
        page.getByText('Dieses Dokument darf nicht sichtbar sein'),
      ).toHaveCount(0)
    } finally {
      await scenario.cleanup()
    }
  })
})
