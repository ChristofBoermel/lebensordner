import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDownloadTokenSingle = vi.fn()
const mockProfileSingle = vi.fn()
const mockUpdateEq = vi.fn()
const tokenEqCalls: Array<{ column: string; value: string }> = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'download_tokens') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => {
              tokenEqCalls.push({ column, value })
              return {
                single: (...args: unknown[]) => mockDownloadTokenSingle(...args),
              }
            }),
          })),
          update: vi.fn(() => ({
            eq: (...args: unknown[]) => mockUpdateEq(...args),
          })),
        }
      }

      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: (...args: unknown[]) => mockProfileSingle(...args),
            })),
          })),
        }
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      }
    }),
  })),
}))

vi.mock('@/lib/security/download-link-recipient-challenge', () => ({
  getRecipientChallengeCookieName: vi.fn(() => 'dlv_test'),
  readCookieValueFromHeader: vi.fn(() => 'cookie-value'),
  verifyRecipientChallengeCookieValue: vi.fn(() => true),
}))

describe('Download link token hash lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tokenEqCalls.length = 0
  })

  it('verifies token by token_hash in verify endpoint', async () => {
    mockDownloadTokenSingle.mockResolvedValueOnce({
      data: {
        id: 'token-1',
        user_id: 'owner-1',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        used_at: null,
        link_type: 'download',
      },
      error: null,
    })
    mockProfileSingle.mockResolvedValueOnce({
      data: { full_name: 'Owner', email: 'owner@example.com' },
      error: null,
    })

    const rawToken = 'raw-download-token'
    const expectedHash = createHash('sha256').update(rawToken).digest('hex')

    const { GET } = await import('@/app/api/download-link/verify/[token]/route')
    const response = await GET(
      new Request('http://localhost/api/download-link/verify/raw-download-token'),
      { params: Promise.resolve({ token: rawToken }) },
    )

    expect(response.status).toBe(200)
    expect(tokenEqCalls).toContainEqual({ column: 'token_hash', value: expectedHash })
    expect(tokenEqCalls.find((call) => call.column === 'token')).toBeUndefined()
  })

  it('marks usage by token_hash in mark-used endpoint', async () => {
    mockDownloadTokenSingle.mockResolvedValueOnce({
      data: {
        id: 'token-2',
        link_type: 'download',
      },
      error: null,
    })
    mockUpdateEq.mockResolvedValueOnce({ error: null })

    const rawToken = 'mark-used-token'
    const expectedHash = createHash('sha256').update(rawToken).digest('hex')

    const { POST } = await import('@/app/api/download-link/[token]/mark-used/route')
    const response = await POST(
      new Request('http://localhost/api/download-link/mark-used-token/mark-used', { method: 'POST' }),
      { params: Promise.resolve({ token: rawToken }) },
    )

    expect(response.status).toBe(200)
    expect(tokenEqCalls).toContainEqual({ column: 'token_hash', value: expectedHash })
    expect(tokenEqCalls.find((call) => call.column === 'token')).toBeUndefined()
  })
})
