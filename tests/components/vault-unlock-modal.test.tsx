import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VaultUnlockModal } from '@/components/vault/VaultUnlockModal'
import { useVault } from '@/lib/vault/VaultContext'

vi.mock('@/lib/vault/VaultContext', () => ({
  useVault: vi.fn(),
}))

const mockUseVault = useVault as unknown as ReturnType<typeof vi.fn>

function createVaultMock(overrides: Record<string, unknown> = {}) {
  return {
    unlock: vi.fn(),
    unlockWithRecovery: vi.fn(),
    resetPassphraseWithRecovery: vi.fn(),
    isUnlocked: false,
    isSetUp: true,
    masterKey: null,
    requestUnlock: vi.fn(),
    requestSetup: vi.fn(),
    closeSetup: vi.fn(),
    isSetupRequested: false,
    setup: vi.fn(),
    lock: vi.fn(),
    ...overrides,
  }
}

describe('VaultUnlockModal', () => {
  beforeEach(() => {
    mockUseVault.mockReturnValue(createVaultMock())
  })

  it('VaultUnlock.Passphrase renders passphrase form', () => {
    render(<VaultUnlockModal onClose={vi.fn()} />)

    expect(screen.getByLabelText('Passwort')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entsperren' })).toBeInTheDocument()
  })

  it('VaultUnlock.Recovery renders recovery form', async () => {
    const user = userEvent.setup()
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.click(
      screen.getByRole('button', { name: 'Wiederherstellungsschlussel verwenden' })
    )

    expect(screen.getByLabelText('Wiederherstellungsschlussel')).toBeInTheDocument()
  })

  it('clicking "Wiederherstellungsschlussel verwenden" switches mode', async () => {
    const user = userEvent.setup()
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.click(
      screen.getByRole('button', { name: 'Wiederherstellungsschlussel verwenden' })
    )

    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Wiederherstellungsschlussel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Passwort verwenden' })).toBeInTheDocument()
  })

  it('clicking "Passwort verwenden" switches back', async () => {
    const user = userEvent.setup()
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.click(
      screen.getByRole('button', { name: 'Wiederherstellungsschlussel verwenden' })
    )
    await user.click(screen.getByRole('button', { name: 'Passwort verwenden' }))

    expect(screen.getByLabelText('Passwort')).toBeInTheDocument()
    expect(screen.queryByLabelText('Wiederherstellungsschlussel')).not.toBeInTheDocument()
  })

  it('calls unlock with passphrase on submit', async () => {
    const user = userEvent.setup()
    const vault = createVaultMock()
    mockUseVault.mockReturnValue(vault)
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Passwort'), 'mein-passwort')
    await user.click(screen.getByRole('button', { name: 'Entsperren' }))

    expect(vault.unlock).toHaveBeenCalledWith('mein-passwort')
  })

  it('submits passphrase form with Enter key', async () => {
    const user = userEvent.setup()
    const vault = createVaultMock()
    mockUseVault.mockReturnValue(vault)
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Passwort'), 'mein-passwort{Enter}')

    expect(vault.unlock).toHaveBeenCalledWith('mein-passwort')
    expect(vault.unlockWithRecovery).not.toHaveBeenCalled()
  })

  it('calls unlockWithRecovery with recovery key', async () => {
    const user = userEvent.setup()
    const vault = createVaultMock()
    mockUseVault.mockReturnValue(vault)
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.click(
      screen.getByRole('button', { name: 'Wiederherstellungsschlussel verwenden' })
    )
    await user.type(
      screen.getByLabelText('Wiederherstellungsschlussel'),
      'recovery-key-123'
    )
    await user.click(screen.getByRole('button', { name: 'Entsperren' }))

    expect(vault.unlockWithRecovery).toHaveBeenCalledWith('recovery-key-123')
  })

  it('switch buttons do not submit the form', async () => {
    const user = userEvent.setup()
    const vault = createVaultMock()
    mockUseVault.mockReturnValue(vault)
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Passwort'), 'mein-passwort')
    await user.click(
      screen.getByRole('button', { name: 'Wiederherstellungsschlussel verwenden' })
    )
    await user.click(screen.getByRole('button', { name: 'Passwort verwenden' }))

    expect(vault.unlock).not.toHaveBeenCalled()
    expect(vault.unlockWithRecovery).not.toHaveBeenCalled()
  })

  it('calls resetPassphraseWithRecovery when reset mode is used', async () => {
    const user = userEvent.setup()
    const vault = createVaultMock()
    mockUseVault.mockReturnValue(vault)
    render(<VaultUnlockModal onClose={vi.fn()} />)

    await user.click(
      screen.getByRole('button', { name: 'Wiederherstellungsschlussel verwenden' })
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Passwort mit Wiederherstellungsschlussel zurucksetzen',
      })
    )
    await user.type(
      screen.getByLabelText('Wiederherstellungsschlussel'),
      'recovery-key-123'
    )
    await user.type(screen.getByLabelText('Neues Passwort'), 'mein-neues-passwort')
    await user.type(
      screen.getByLabelText('Neues Passwort bestätigen'),
      'mein-neues-passwort'
    )
    await user.click(screen.getByRole('button', { name: 'Passwort zurucksetzen' }))

    expect(vault.resetPassphraseWithRecovery).toHaveBeenCalledWith(
      'recovery-key-123',
      'mein-neues-passwort'
    )
  })

  it('disables Entsperren button when active input is empty', async () => {
    const user = userEvent.setup()
    render(<VaultUnlockModal onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Entsperren' })).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: 'Wiederherstellungsschlussel verwenden' })
    )

    expect(screen.getByRole('button', { name: 'Entsperren' })).toBeDisabled()
  })
})
