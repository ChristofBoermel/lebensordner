import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

const createFetchMock = () =>
  vi.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/consent/check-health-consent')) {
      return Promise.resolve(createResponse({ granted: true }))
    }
    if (url.includes('/api/notfall') && (!init?.method || init.method === 'GET')) {
      return Promise.resolve(createResponse({
        emergencyContacts: [],
        medicalInfo: { medications: [] },
        directives: null,
        funeralWishes: null,
      }))
    }
    if (url.includes('/api/vaccinations')) {
      return Promise.resolve(createResponse({ vaccinations: [] }))
    }
    return Promise.resolve(createResponse({}))
  }) as unknown as typeof fetch

describe('Notfall Page — Medication Form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Form label is always "Form"', async () => {
    global.fetch = createFetchMock()

    render(<NotfallPage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Gesundheit/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('tab', { name: /Gesundheit/i }))

    // Click the "Hinzufügen" button to open the MedikamentDialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hinzufügen/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(screen.getByText('Form')).toBeInTheDocument()
    })
  })

  it('Einheit input has placeholder "z.B. Stück"', async () => {
    global.fetch = createFetchMock()

    render(<NotfallPage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Gesundheit/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('tab', { name: /Gesundheit/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hinzufügen/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('z.B. Stück')).toBeInTheDocument()
    })
  })

  it('blur on an input does not trigger an additional API fetch', async () => {
    const fetchMock = createFetchMock()
    global.fetch = fetchMock

    render(<NotfallPage />)

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Gesundheit/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('tab', { name: /Gesundheit/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hinzufügen/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('z.B. Metformin')).toBeInTheDocument()
    })

    const wirkstoffInput = screen.getByPlaceholderText('z.B. Metformin')

    // Count GET calls to /api/notfall before blur
    const getCallsBefore = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]: [string, RequestInit]) =>
        typeof url === 'string' && url.includes('/api/notfall') && (!init?.method || init.method === 'GET')
    ).length

    await userEvent.type(wirkstoffInput, 'Aspirin')
    fireEvent.blur(wirkstoffInput)

    // Allow any microtask/promise queue to flush
    await new Promise((r) => setTimeout(r, 50))

    const getCallsAfter = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]: [string, RequestInit]) =>
        typeof url === 'string' && url.includes('/api/notfall') && (!init?.method || init.method === 'GET')
    ).length

    expect(getCallsAfter).toBe(getCallsBefore)
  })
})
