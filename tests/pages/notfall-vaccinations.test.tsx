import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotfallPage from '@/app/(dashboard)/notfall/page'
import { createSupabaseMock } from '../mocks/supabase-client'

const createMockBuilder = (tableName: string) => {
  const builder: Record<string, any> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.single = vi.fn().mockResolvedValue({
    data: tableName === 'profiles' ? { subscription_status: null } : null,
    error: null,
  })
  builder.in = vi.fn().mockResolvedValue({ data: [], error: null })
  builder.update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
  builder.insert = vi.fn().mockResolvedValue({ data: null, error: null })
  return builder
}

const { client: mockSupabaseClient, getUser: mockGetUser } = createSupabaseMock()

mockGetUser.mockResolvedValue({
  data: { user: { id: 'test-user-id', email: 'test@example.com' } },
  error: null,
})
mockSupabaseClient.from = vi.fn((tableName: string) => createMockBuilder(tableName)) as any
;(mockSupabaseClient as any).storage = { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) }

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

vi.mock('@/lib/vault/VaultContext', () => ({
  useVault: () => ({
    isSetUp: false,
    isUnlocked: false,
    masterKey: null,
    setup: vi.fn(),
    unlock: vi.fn(),
    unlockWithRecovery: vi.fn(),
    lock: vi.fn(),
  }),
}))

const createResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
}) as Response

const mockVaccination = { id: 'vac-1', name: 'Tetanus', is_standard: true, month: null, year: 2020 }

const createFetchMock = (confirmDelete: boolean) =>
  vi.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/consent/check-health-consent')) {
      return Promise.resolve(createResponse({ granted: true }))
    }
    if (url.includes('/api/notfall') && (!init?.method || init.method === 'GET')) {
      return Promise.resolve(createResponse({
        emergencyContacts: [],
        medicalInfo: { vaccinations: [mockVaccination] },
        directives: null,
        funeralWishes: null,
      }))
    }
    if (url.includes('/api/vaccinations/vac-1') && init?.method === 'DELETE') {
      return Promise.resolve(createResponse({ success: true }))
    }
    if (url.includes('/api/vaccinations')) {
      return Promise.resolve(createResponse({ vaccinations: [mockVaccination] }))
    }
    return Promise.resolve(createResponse({}))
  }) as unknown as typeof fetch

describe('Notfall Page — Vaccination delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not call DELETE when confirm returns false', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    global.fetch = createFetchMock(false)

    render(<NotfallPage />)

    // Navigate to gesundheit tab where vaccinations are rendered
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Gesundheit/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('tab', { name: /Gesundheit/i }))

    await waitFor(() => {
      expect(screen.getByText('Tetanus')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    const tetanusRow = rows.find((row) => within(row).queryByText('Tetanus'))
    expect(tetanusRow).toBeDefined()
    const buttons = within(tetanusRow!).getAllByRole('button')
    await userEvent.click(buttons[1])

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    const deleteCalls = fetchMock.mock.calls.filter(
      ([url, init]: [string, RequestInit]) =>
        typeof url === 'string' && url.includes('/api/vaccinations/vac-1') && init?.method === 'DELETE'
    )
    expect(deleteCalls).toHaveLength(0)
  })

  it('calls DELETE when confirm returns true', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    global.fetch = createFetchMock(true)

    render(<NotfallPage />)

    // Navigate to gesundheit tab where vaccinations are rendered
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Gesundheit/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('tab', { name: /Gesundheit/i }))

    await waitFor(() => {
      expect(screen.getByText('Tetanus')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    const tetanusRow = rows.find((row) => within(row).queryByText('Tetanus'))
    expect(tetanusRow).toBeDefined()
    const buttons = within(tetanusRow!).getAllByRole('button')
    await userEvent.click(buttons[1])

    await waitFor(() => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>
      const deleteCalls = fetchMock.mock.calls.filter(
        ([url, init]: [string, RequestInit]) =>
          typeof url === 'string' && url.includes('/api/vaccinations/vac-1') && init?.method === 'DELETE'
      )
      expect(deleteCalls).toHaveLength(1)
    })
  })
})
