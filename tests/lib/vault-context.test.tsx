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
  const { isSetUp, isUnlocked, lock } = useVault()

  return (
    <div>
      <div data-testid="is-set-up">{String(isSetUp)}</div>
      <div data-testid="is-unlocked">{String(isUnlocked)}</div>
      <button type="button" onClick={lock}>
        Lock
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
})
