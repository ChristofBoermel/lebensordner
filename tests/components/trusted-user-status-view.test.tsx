import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TrustedUserStatusView } from '@/components/trusted-access/TrustedUserStatusView'

describe('TrustedUserStatusView', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any // never resolves
    render(<TrustedUserStatusView />)
    expect(screen.getByText(/laden/i)).toBeInTheDocument()
  })

  it('shows not_linked_yet state when relationship is not active', async () => {
    // Constructor-time fn per MEMORY.md: survives vi.restoreAllMocks()
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        shares: [],
        relationships: [
          { ownerId: 'owner-1', trustedPersonId: 'tp-1', status: 'not_linked_yet', relationshipStatus: 'accepted_pending_setup' },
        ],
      }),
    })) as any

    render(<TrustedUserStatusView />)

    await waitFor(() => {
      expect(screen.getByText(/einrichtung/i)).toBeInTheDocument()
    })
  })

  it('shows waiting_for_share state when linked but no documents shared', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        shares: [],
        relationships: [
          { ownerId: 'owner-1', trustedPersonId: 'tp-1', status: 'waiting_for_share', relationshipStatus: 'active' },
        ],
      }),
    })) as any

    render(<TrustedUserStatusView />)

    await waitFor(() => {
      expect(screen.getByText(/verbindung hergestellt/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when there are no relationships', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ shares: [], relationships: [] }),
    })) as any

    render(<TrustedUserStatusView />)

    await waitFor(() => {
      expect(screen.getByText(/keine einladungen/i)).toBeInTheDocument()
    })
  })
})
