import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VaultProvider, useVault } from '@/lib/vault/VaultContext'

const deriveMasterKeyMock = vi.fn()
const fromBase64Mock = vi.fn()
const toBase64Mock = vi.fn()
const unwrapKeyMock = vi.fn()
const wrapKeyMock = vi.fn()

vi.mock('@/lib/security/document-e2ee', () => ({
  deriveMasterKey: (...args: unknown[]) => deriveMasterKeyMock(...args),
  fromBase64: (...args: unknown[]) => fromBase64Mock(...args),
  toBase64: (...args: unknown[]) => toBase64Mock(...args),
  unwrapKey: (...args: unknown[]) => unwrapKeyMock(...args),
  wrapKey: (...args: unknown[]) => wrapKeyMock(...args),
}))

function VaultProbe() {
  const { isSetUp, isUnlocked, lock, resetPassphraseWithRecovery } = useVault()

  return (
    <div>
      <div data-testid="is-set-up">{String(isSetUp)}</div>
      <div data-testid="is-unlocked">{String(isUnlocked)}</div>
      <button type="button" onClick={lock}>
        Lock
      </button>
      <button
        type="button"
        onClick={() => {
          void resetPassphraseWithRecovery('recovery-key', 'new-passphrase-1234').catch(() => {})
        }}
      >
        Reset passphrase
      </button>
    </div>
  )
}

describe('VaultProvider session cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    global.fetch = vi.fn()

    deriveMasterKeyMock.mockResolvedValue('pdk')
    fromBase64Mock.mockImplementation((value: string) => value)
    toBase64Mock.mockImplementation((value: unknown) => String(value))
    unwrapKeyMock.mockResolvedValue({ id: 'mk' } as unknown as CryptoKey)
    wrapKeyMock.mockResolvedValue('wrapped')
  })

  it('auto-unlocks from cached passphrase when vault exists', async () => {
    sessionStorage.setItem('lo_v_p', 'cached-passphrase')

    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          kdf_salt: 'salt-base64',
          kdf_params: { iterations: 1, hash: 'SHA-256' },
          wrapped_mk: 'wrapped-mk',
        }),
      })

    render(
      <VaultProvider>
        <VaultProbe />
      </VaultProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-set-up')).toHaveTextContent('true')
      expect(screen.getByTestId('is-unlocked')).toHaveTextContent('true')
    })

    expect(deriveMasterKeyMock).toHaveBeenCalledWith(
      'cached-passphrase',
      'salt-base64',
      { iterations: 1, hash: 'SHA-256' }
    )
    expect(unwrapKeyMock).toHaveBeenCalledWith('wrapped-mk', 'pdk', 'AES-KW')
    expect(sessionStorage.getItem('lo_v_p')).toBe('cached-passphrase')
  })

  it('clears cached passphrase when auto-unlock fails', async () => {
    sessionStorage.setItem('lo_v_p', 'bad-passphrase')
    unwrapKeyMock.mockRejectedValueOnce(new Error('invalid passphrase'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          kdf_salt: 'salt-base64',
          kdf_params: { iterations: 1, hash: 'SHA-256' },
          wrapped_mk: 'wrapped-mk',
        }),
      })

    render(
      <VaultProvider>
        <VaultProbe />
      </VaultProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-set-up')).toHaveTextContent('true')
      expect(screen.getByTestId('is-unlocked')).toHaveTextContent('false')
    })

    expect(sessionStorage.getItem('lo_v_p')).toBeNull()
    consoleErrorSpy.mockRestore()
  })

  it('removes cached passphrase when lock is called', async () => {
    sessionStorage.setItem('lo_v_p', 'cached-passphrase')
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ exists: false }),
    })

    render(
      <VaultProvider>
        <VaultProbe />
      </VaultProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-set-up')).toHaveTextContent('false')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Lock' }))
    expect(sessionStorage.getItem('lo_v_p')).toBeNull()
  })

  it('resets passphrase using recovery key and keeps vault unlocked', async () => {
    const user = userEvent.setup()
    deriveMasterKeyMock
      .mockResolvedValueOnce('recovery-derived-key')
      .mockResolvedValueOnce('new-passphrase-derived-key')
    unwrapKeyMock.mockResolvedValueOnce({ id: 'mk-after-reset' } as unknown as CryptoKey)
    wrapKeyMock.mockResolvedValueOnce('new-wrapped-mk')

    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true, webauthn_credential_id: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exists: true,
          kdf_params: { iterations: 1, hash: 'SHA-256' },
          wrapped_mk_with_recovery: 'wrapped-mk-with-recovery',
          recovery_key_salt: 'recovery-salt-base64',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

    render(
      <VaultProvider>
        <VaultProbe />
      </VaultProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-set-up')).toHaveTextContent('true')
    })

    await user.click(screen.getByRole('button', { name: 'Reset passphrase' }))

    await waitFor(() => {
      expect(screen.getByTestId('is-unlocked')).toHaveTextContent('true')
    })

    expect(deriveMasterKeyMock).toHaveBeenNthCalledWith(
      1,
      'recovery-key',
      'recovery-salt-base64',
      { iterations: 1, hash: 'SHA-256' }
    )
    expect(deriveMasterKeyMock).toHaveBeenNthCalledWith(
      2,
      'new-passphrase-1234',
      expect.any(Uint8Array),
      { iterations: 1, hash: 'SHA-256' }
    )
    expect(unwrapKeyMock).toHaveBeenCalledWith(
      'wrapped-mk-with-recovery',
      'recovery-derived-key',
      'AES-KW'
    )
    expect(wrapKeyMock).toHaveBeenCalledWith(
      { id: 'mk-after-reset' },
      'new-passphrase-derived-key'
    )
    expect(sessionStorage.getItem('lo_v_p')).toBe('new-passphrase-1234')
  })

  it('fails reset when recovery key is wrong', async () => {
    const user = userEvent.setup()
    deriveMasterKeyMock.mockResolvedValueOnce('recovery-derived-key')
    unwrapKeyMock.mockRejectedValueOnce(new Error('invalid recovery key'))

    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true, webauthn_credential_id: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exists: true,
          kdf_params: { iterations: 1, hash: 'SHA-256' },
          wrapped_mk_with_recovery: 'wrapped-mk-with-recovery',
          recovery_key_salt: 'recovery-salt-base64',
        }),
      })

    render(
      <VaultProvider>
        <VaultProbe />
      </VaultProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-set-up')).toHaveTextContent('true')
    })

    await user.click(screen.getByRole('button', { name: 'Reset passphrase' }))

    await waitFor(() => {
      expect(screen.getByTestId('is-unlocked')).toHaveTextContent('false')
    })

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
    expect(wrapKeyMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('lo_v_p')).toBeNull()
  })
})
