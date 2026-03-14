import { describe, expect, it } from 'vitest'
import {
  buildOwnerConnectionSnapshot,
  buildTrustedUserConnectionSnapshot,
  diffConnectionSnapshots,
} from '@/lib/security/trusted-access-live-status'

describe('trusted access live status transitions', () => {
  it('detects owner-side connect and disconnect transitions by trusted-user email', () => {
    const previous = buildOwnerConnectionSnapshot([
      {
        id: 'tp-1',
        user_id: 'owner-1',
        name: 'Anna Beispiel',
        email: 'anna@example.com',
        phone: null,
        relationship: 'Tochter',
        access_level: 'immediate',
        access_delay_hours: 0,
        notes: null,
        is_active: true,
        invitation_token: null,
        invitation_status: 'accepted',
        invitation_sent_at: null,
        invitation_accepted_at: null,
        linked_user_id: 'trusted-1',
        email_sent_at: null,
        email_error: null,
        email_retry_count: 0,
        email_status: 'sent',
        relationship_status: 'accepted_pending_setup',
        invitation_expires_at: null,
        created_at: '',
        updated_at: '',
      },
    ] as any)

    const next = buildOwnerConnectionSnapshot([
      {
        id: 'tp-2',
        user_id: 'owner-1',
        name: 'Anna Beispiel',
        email: 'anna@example.com',
        phone: null,
        relationship: 'Tochter',
        access_level: 'immediate',
        access_delay_hours: 0,
        notes: null,
        is_active: true,
        invitation_token: null,
        invitation_status: 'accepted',
        invitation_sent_at: null,
        invitation_accepted_at: null,
        linked_user_id: 'trusted-1',
        email_sent_at: null,
        email_error: null,
        email_retry_count: 0,
        email_status: 'sent',
        relationship_status: 'active',
        invitation_expires_at: null,
        created_at: '',
        updated_at: '',
      },
    ] as any)

    expect(diffConnectionSnapshots(previous, next)).toEqual([
      {
        key: 'anna@example.com',
        label: 'Anna Beispiel',
        transition: 'connected',
      },
    ])

    expect(diffConnectionSnapshots(next, buildOwnerConnectionSnapshot([] as any))).toEqual([
      {
        key: 'anna@example.com',
        label: 'Anna Beispiel',
        transition: 'disconnected',
      },
    ])
  })

  it('detects trusted-user connection transitions from setup pending to connected and then removed', () => {
    const previous = buildTrustedUserConnectionSnapshot([
      {
        ownerId: 'owner-1',
        trustedPersonId: 'tp-1',
        status: 'not_linked_yet',
        relationshipStatus: 'setup_link_sent',
      },
    ], [])

    const connected = buildTrustedUserConnectionSnapshot([
      {
        ownerId: 'owner-1',
        trustedPersonId: 'tp-1',
        status: 'waiting_for_share',
        relationshipStatus: 'active',
      },
    ], [])

    expect(diffConnectionSnapshots(previous, connected)).toEqual([
      {
        key: 'owner-1:tp-1',
        label: 'Lebensordner',
        transition: 'connected',
      },
    ])

    const removed = buildTrustedUserConnectionSnapshot([], [])
    expect(diffConnectionSnapshots(connected, removed)).toEqual([
      {
        key: 'owner-1:tp-1',
        label: 'Lebensordner',
        transition: 'disconnected',
      },
    ])
  })
})
