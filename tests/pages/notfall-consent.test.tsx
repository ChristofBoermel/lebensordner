import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotfallPage from '@/app/(dashboard)/notfall/page'

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-user-id', email: 'test@example.com' } },
  error: null,
})

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

const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: (tableName: string) => createMockBuilder(tableName),
  storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) },
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

const createResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
}) as Response

describe('Notfall Page Consent Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips /api/notfall before consent and shows modal', async () => {
    let notfallCalls = 0
    global.fetch = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/consent/check-health-consent')) {
        return Promise.resolve(createResponse({ granted: false }))
      }
      if (url.includes('/api/notfall')) {
        notfallCalls += 1
        return Promise.resolve(createResponse({}))
      }
      return Promise.resolve(createResponse({}))
    }) as unknown as typeof fetch

    render(<NotfallPage />)

    await waitFor(() => {
      expect(screen.getByTestId('consent-modal-health_data')).toBeInTheDocument()
    })

    expect(notfallCalls).toBe(0)
  })

  it('shows consent modal on 403 response from /api/notfall', async () => {
    global.fetch = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/consent/check-health-consent')) {
        return Promise.resolve(createResponse({ granted: true }))
      }
      if (url.includes('/api/notfall')) {
        return Promise.resolve(
          createResponse(
            { error: 'Gesundheitsdaten-Einwilligung erforderlich', requiresConsent: true },
            403
          )
        )
      }
      return Promise.resolve(createResponse({}))
    }) as unknown as typeof fetch

    render(<NotfallPage />)

    await waitFor(() => {
      expect(screen.getByTestId('consent-modal-health_data')).toBeInTheDocument()
    })
  })

  it('fetches /api/notfall after consent is granted', async () => {
    let notfallCalls = 0
    global.fetch = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/consent/check-health-consent')) {
        return Promise.resolve(createResponse({ granted: false }))
      }
      if (url.includes('/api/consent/grant-health-data')) {
        return Promise.resolve(createResponse({ success: true }))
      }
      if (url.includes('/api/notfall')) {
        notfallCalls += 1
        return Promise.resolve(createResponse({
          emergencyContacts: [],
          medicalInfo: null,
          directives: null,
          funeralWishes: null,
        }))
      }
      return Promise.resolve(createResponse({}))
    }) as unknown as typeof fetch

    render(<NotfallPage />)

    await waitFor(() => {
      expect(screen.getByTestId('consent-modal-health_data')).toBeInTheDocument()
    })

    await userEvent.click(
      screen.getByLabelText('Ich stimme ausdrücklich der Verarbeitung meiner Gesundheitsdaten gemäß Art. 9 DSGVO zu')
    )
    await userEvent.click(screen.getByRole('button', { name: 'Ich stimme zu' }))

    await waitFor(() => {
      expect(notfallCalls).toBeGreaterThan(0)
    })
  })
})
