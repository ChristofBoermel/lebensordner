import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkShareDialog } from '@/components/sharing/BulkShareDialog'
import { useVault } from '@/lib/vault/VaultContext'

vi.mock('@/lib/vault/VaultContext', () => ({
  useVault: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}))

const mockUseVault = useVault as unknown as ReturnType<typeof vi.fn>

function createVaultMock(overrides: Record<string, unknown> = {}) {
  return {
    isUnlocked: true,
    masterKey: null,
    requestUnlock: vi.fn(),
    requestSetup: vi.fn(),
    closeSetup: vi.fn(),
    isSetupRequested: false,
    isSetUp: true,
    setup: vi.fn(),
    unlock: vi.fn(),
    unlockWithRecovery: vi.fn(),
    lock: vi.fn(),
    ...overrides,
  }
}

function renderBulkShareDialog(overrides: Record<string, unknown> = {}) {
  const baseProps = {
    isOpen: true,
    documents: [
      { id: 'doc-1', title: 'Reisepass', wrapped_dek: 'wrapped-1' },
      { id: 'doc-2', title: 'Steuerbescheid', wrapped_dek: 'wrapped-2' },
    ],
    trustedPersons: [
      { id: 'tp-1', name: 'Anna Schmidt', linked_user_id: 'linked-1' },
      { id: 'tp-2', name: 'Unregistriert', linked_user_id: null },
    ],
    userId: 'user-1',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  }

  return render(<BulkShareDialog {...baseProps} {...overrides} />)
}

describe('BulkShareDialog', () => {
  beforeEach(() => {
    mockUseVault.mockReturnValue(createVaultMock())
  })

  it('BulkShare.DocumentPicker renders document list', () => {
    renderBulkShareDialog()

    expect(screen.getByText('Reisepass')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alle auswahlen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keine' })).toBeInTheDocument()
  })

  it('search filters document list', async () => {
    const user = userEvent.setup()
    renderBulkShareDialog()

    await user.type(screen.getByPlaceholderText('Dokumente suchen...'), 'Reise')

    expect(screen.getByText('Reisepass')).toBeInTheDocument()
    expect(screen.queryByText('Steuerbescheid')).not.toBeInTheDocument()
  })

  it('"Weiter →" button disabled when nothing selected', () => {
    renderBulkShareDialog()

    expect(screen.getByRole('button', { name: 'Weiter →' })).toBeDisabled()
  })

  it('"Weiter →" navigates to Settings step', async () => {
    const user = userEvent.setup()
    renderBulkShareDialog()

    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Weiter →' }))

    expect(screen.getByLabelText('Empfanger')).toBeInTheDocument()
  })

  it('BulkShare.Settings renders recipient selector and permission controls', async () => {
    const user = userEvent.setup()
    renderBulkShareDialog()

    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Weiter →' }))

    const recipient = document.getElementById('bulk-recipient')
    expect(recipient).toBeInTheDocument()
    expect(recipient?.tagName).toBe('SELECT')
    expect(screen.getByRole('button', { name: 'Nur ansehen' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Herunterladen erlaubt' })
    ).toBeInTheDocument()
  })

  it('"← Zuruck" navigates back to DocumentPicker', async () => {
    const user = userEvent.setup()
    renderBulkShareDialog()

    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Weiter →' }))
    await user.click(screen.getByRole('button', { name: '← Zuruck' }))

    expect(screen.getByText('Reisepass')).toBeInTheDocument()
  })

  it('shows vault-locked warning when isUnlocked is false', async () => {
    const user = userEvent.setup()
    mockUseVault.mockReturnValue(createVaultMock({ isUnlocked: false }))
    renderBulkShareDialog()

    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: 'Weiter →' }))

    expect(
      screen.getByText('Tresor muss entsperrt sein, um Dokumente zu teilen')
    ).toBeInTheDocument()
  })
})
