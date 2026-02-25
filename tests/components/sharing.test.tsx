import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createSupabaseMock } from '../mocks/supabase-client'

// ---- Module mocks ----

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/vault/VaultContext', () => ({
  useVault: vi.fn(),
}))

import { createClient } from '@/lib/supabase/client'
import { useVault } from '@/lib/vault/VaultContext'

const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>
const mockUseVault = useVault as unknown as ReturnType<typeof vi.fn>

// ---- Components ----

import { ShareDocumentDialog } from '@/components/sharing/ShareDocumentDialog'
import { ActiveSharesList } from '@/components/sharing/ActiveSharesList'
import { ReceivedSharesList } from '@/components/sharing/ReceivedSharesList'

// ---- Helpers ----

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  title: 'Test Dokument',
  wrapped_dek: 'base64encodedwrappeddek',
  ...overrides,
})

const makeShareDialogProps = (overrides: Record<string, unknown> = {}) => ({
  document: makeDoc(),
  trustedPersons: [
    { id: 'tp-1', name: 'Max Mustermann', linked_user_id: 'user-tp-1' },
    { id: 'tp-2', name: 'Unregistriert', linked_user_id: null },
  ],
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  onRequestVaultUnlock: vi.fn(),
  ...overrides,
})

// ---- Test: ShareDocumentDialog ----

describe('ShareDocumentDialog', () => {
  beforeEach(() => {
    const { client } = createSupabaseMock({
      getUser: { data: { user: { id: 'user-owner' } }, error: null },
    })
    mockCreateClient.mockReturnValue(client)
    mockUseVault.mockReturnValue({ isUnlocked: true, masterKey: {} })
  })

  it('renders only registered trusted persons (linked_user_id !== null) in the select', async () => {
    render(<ShareDocumentDialog {...makeShareDialogProps()} />)

    await waitFor(() => {
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
    })
    expect(screen.queryByText('Unregistriert')).not.toBeInTheDocument()
  })

  it('shows amber vault warning and disables Teilen button when vault is locked', async () => {
    mockUseVault.mockReturnValue({ isUnlocked: false, masterKey: null })

    render(<ShareDocumentDialog {...makeShareDialogProps()} />)

    await waitFor(() => {
      expect(
        screen.getByText('Tresor muss entsperrt sein, um Dokumente zu teilen')
      ).toBeInTheDocument()
    })

    const shareButton = screen.getByRole('button', { name: 'Teilen' })
    expect(shareButton).toBeDisabled()
  })

  it('disables Teilen button when no recipient is selected', async () => {
    render(<ShareDocumentDialog {...makeShareDialogProps()} />)

    await waitFor(() => {
      const shareButton = screen.getByRole('button', { name: 'Teilen' })
      expect(shareButton).toBeDisabled()
    })
  })
})

// ---- Test: ActiveSharesList ----

const makeActiveShares = () => [
  {
    id: 'share-1',
    document_id: 'doc-1',
    trusted_person_id: 'tp-1',
    permission: 'view',
    expires_at: null,
    revoked_at: null,
  },
  {
    id: 'share-2',
    document_id: 'doc-2',
    trusted_person_id: 'tp-2',
    permission: 'download',
    expires_at: null,
    revoked_at: '2026-01-01T00:00:00Z',
  },
]

describe('ActiveSharesList', () => {
  beforeEach(() => {
    const { client } = createSupabaseMock({
      then: { data: makeActiveShares(), error: null },
    })
    mockCreateClient.mockReturnValue(client)
  })

  it('renders active shares and hides revoked ones', async () => {
    render(<ActiveSharesList ownerId="user-owner" />)

    await waitFor(() => {
      // share-1 is active (revoked_at: null), should appear
      // share-2 is revoked, should not appear
      expect(screen.queryByText('share-2')).not.toBeInTheDocument()
    })
  })

  it('calls DELETE fetch with correct id when Widerrufen is confirmed', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { client, thenFn } = createSupabaseMock({
      then: { data: makeActiveShares(), error: null },
    })
    // Second call for refetch after revoke returns empty
    let callCount = 0
    thenFn.mockImplementation((onFulfilled) => {
      callCount++
      const data = callCount <= 3
        ? makeActiveShares()
        : []
      return Promise.resolve({ data, error: null }).then(onFulfilled)
    })
    mockCreateClient.mockReturnValue(client)

    render(<ActiveSharesList ownerId="user-owner" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Widerrufen' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Widerrufen' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ja' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Ja' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/documents/share-token?id=share-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    vi.unstubAllGlobals()
  })
})

// ---- Test: ReceivedSharesList ----

const now = Date.now()
const soonExpiry = new Date(now + 24 * 3600 * 1000).toISOString() // 24 h from now
const laterExpiry = new Date(now + 10 * 24 * 3600 * 1000).toISOString() // 10 days

const makeReceivedShares = () => [
  {
    id: 'rshare-1',
    document_id: 'doc-1',
    owner_id: 'owner-1',
    wrapped_dek_for_tp: 'wrapped',
    expires_at: soonExpiry,
    permission: 'view',
    documents: {
      id: 'doc-1',
      title: 'Ablaufendes Dokument',
      category: 'identitaet',
      file_name: 'test.pdf',
      file_iv: 'someiv',
      file_type: 'application/pdf',
    },
    profiles: { full_name: 'Anna Schmidt', first_name: null, last_name: null },
  },
  {
    id: 'rshare-2',
    document_id: 'doc-2',
    owner_id: 'owner-2',
    wrapped_dek_for_tp: 'wrapped2',
    expires_at: laterExpiry,
    permission: 'download',
    documents: {
      id: 'doc-2',
      title: 'Download Dokument',
      category: 'identitaet',
      file_name: 'file.pdf',
      file_iv: 'someiv2',
      file_type: 'application/pdf',
    },
    profiles: { full_name: 'Bob Braun', first_name: null, last_name: null },
  },
]

describe('ReceivedSharesList', () => {
  beforeEach(() => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shares: makeReceivedShares() }),
    })
    vi.stubGlobal('fetch', fetchMock)
    mockUseVault.mockReturnValue({ isUnlocked: true, masterKey: {} })

    const { client } = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
  })

  it('shows amber expiry warning for share expiring within 48 hours', async () => {
    render(<ReceivedSharesList onRequestVaultUnlock={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Zugriff läuft in \d+ Stunden ab/)).toBeInTheDocument()
    })
  })

  it('does not render Herunterladen button for view-only shares', async () => {
    render(<ReceivedSharesList onRequestVaultUnlock={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Ablaufendes Dokument')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByRole('button', { name: 'Ansehen' })
    expect(viewButtons.length).toBeGreaterThan(0)

    // The download button should only appear for 'download' permission shares
    const downloadButtons = screen.getAllByRole('button', { name: 'Herunterladen' })
    // Only rshare-2 has permission='download', so only 1 download button
    expect(downloadButtons).toHaveLength(1)
  })

  it('renders Herunterladen button for download-permission shares', async () => {
    render(<ReceivedSharesList onRequestVaultUnlock={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Download Dokument')).toBeInTheDocument()
    })

    const downloadButtons = screen.getAllByRole('button', { name: 'Herunterladen' })
    expect(downloadButtons).toHaveLength(1)
  })
})
