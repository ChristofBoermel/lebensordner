import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { TrustedUserStatusView } from '@/components/trusted-access/TrustedUserStatusView'
import { TrustedUserAccessProvider } from '@/components/trusted-access/TrustedUserAccessProvider'
import { toast } from '@/components/ui/toast'

const {
  mockSupabaseClient,
  realtimeCallbacks,
} = vi.hoisted(() => {
  const callbacks: Array<() => void> = []
  const channelBuilder = {
    on: vi.fn((_, __, callback: () => void) => {
      callbacks.push(callback)
      return channelBuilder
    }),
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  }

  return {
    mockSupabaseClient: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'trusted-user-1' } },
          error: null,
        })),
      },
      channel: vi.fn(() => channelBuilder),
      removeChannel: vi.fn(async () => 'ok'),
    },
    realtimeCallbacks: callbacks,
  }
})

vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

describe('TrustedUserAccessProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    realtimeCallbacks.length = 0
  })

  it('refreshes on focus and emits a toast when the trusted-user connection becomes active', async () => {
    let calls = 0
    global.fetch = vi.fn(() => {
      calls += 1
      if (calls === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            shares: [],
            relationships: [
              {
                ownerId: 'owner-1',
                trustedPersonId: 'tp-1',
                status: 'not_linked_yet',
                relationshipStatus: 'accepted_pending_setup',
              },
            ],
          }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          shares: [],
          relationships: [
            {
              ownerId: 'owner-1',
              trustedPersonId: 'tp-1',
              status: 'waiting_for_share',
              relationshipStatus: 'active',
            },
          ],
        }),
      })
    }) as any

    render(
      <TrustedUserAccessProvider>
        <TrustedUserStatusView />
      </TrustedUserAccessProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(/einrichtung/i)).toBeInTheDocument()
    })

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => {
      expect(screen.getByText(/warten auf freigaben des besitzers/i)).toBeInTheDocument()
    })

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Verbindung aktiv',
      }),
    )
  })

  it('refreshes when a Supabase Realtime callback fires', async () => {
    let calls = 0
    global.fetch = vi.fn(() => {
      calls += 1
      if (calls === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            shares: [],
            relationships: [],
          }),
        })
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          shares: [
            {
              id: 'share-1',
              owner_id: 'owner-1',
              trusted_person_id: 'tp-1',
              profiles: { full_name: 'Owner Example', first_name: null, last_name: null },
              documents: {
                id: 'doc-1',
                title: 'Vorsorgeplan',
                category: 'vorsorge',
                file_name: 'vorsorge.pdf',
                file_iv: 'iv',
                file_type: 'application/pdf',
              },
              wrapped_dek_for_tp: 'wrapped',
              expires_at: null,
              permission: 'view',
            },
          ],
          relationships: [],
        }),
      })
    }) as any

    render(
      <TrustedUserAccessProvider>
        <TrustedUserStatusView />
      </TrustedUserAccessProvider>,
    )

    await waitFor(() => {
      expect(realtimeCallbacks.length).toBeGreaterThan(0)
    })

    await act(async () => {
      realtimeCallbacks[0]?.()
    })

    await waitFor(() => {
      expect(screen.getByText(/owner example hat bereits dokumente/i)).toBeInTheDocument()
    })
  })
})
