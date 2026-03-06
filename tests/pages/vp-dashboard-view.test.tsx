import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VpDashboardViewPage from '@/app/(dashboard)/vp-dashboard/view/[ownerId]/page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ ownerId: 'owner-123' }),
}))

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(),
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'vp-user-id' } }, error: null })),
  },
  then: vi.fn((cb: any) => Promise.resolve(cb({ data: [], error: null }))),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

function setupAccessLevel(level: string) {
  mockSupabase.single = vi.fn(() =>
    Promise.resolve({ data: { access_level: level }, error: null })
  )
}

describe('VpDashboardViewPage access level UX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ tokens: [] }), { status: 200 }))
    )
    mockSupabase.from.mockReturnValue(mockSupabase)
    mockSupabase.select.mockReturnValue(mockSupabase)
    mockSupabase.eq.mockReturnValue(mockSupabase)
    mockSupabase.then = vi.fn((cb: any) =>
      Promise.resolve(cb({ data: [], error: null }))
    )
  })

  it('shows download button for immediate access', async () => {
    setupAccessLevel('immediate')
    render(<VpDashboardViewPage />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /alle herunterladen/i })).toBeInTheDocument()
    )
  })

  it('hides download button and shows hint for emergency access', async () => {
    setupAccessLevel('emergency')
    render(<VpDashboardViewPage />)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
    )
    expect(screen.getByText(/notfall-ansicht/i)).toBeInTheDocument()
  })

  it('hides download button for after_confirmation access', async () => {
    setupAccessLevel('after_confirmation')
    render(<VpDashboardViewPage />)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
    )
    expect(screen.getByText(/bestätigung/i)).toBeInTheDocument()
  })

  it('after_confirmation: Öffnen button is disabled with hint for each document', async () => {
    setupAccessLevel('after_confirmation')
    mockSupabase.then = vi.fn((cb: any) =>
      Promise.resolve(cb({ data: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', is_encrypted: false }], error: null }))
    )
    render(<VpDashboardViewPage />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /öffnen/i })).toBeDisabled()
    )
    expect(screen.getByText(/bestätigung erforderlich/i)).toBeInTheDocument()
  })

  it('emergency: Öffnen button is enabled (view allowed)', async () => {
    setupAccessLevel('emergency')
    mockSupabase.then = vi.fn((cb: any) =>
      Promise.resolve(cb({ data: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', is_encrypted: false }], error: null }))
    )
    render(<VpDashboardViewPage />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /öffnen/i })).not.toBeDisabled()
    )
  })

  it('error banner clears on next successful action', async () => {
    setupAccessLevel('immediate')
    mockSupabase.then = vi.fn((cb: any) =>
      Promise.resolve(cb({ data: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', is_encrypted: false }], error: null }))
    )

    // First call fails, second succeeds
    let callCount = 0
    global.fetch = vi.fn((url: any) => {
      const urlStr = typeof url === 'string' ? url : (url as Request).url
      if (urlStr.includes('/api/family/view/bytes')) {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(new Response('', { status: 500 }))
        }
        return Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 })
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ tokens: [] }), { status: 200 }))
    })

    render(<VpDashboardViewPage />)
    const openBtn = await screen.findByRole('button', { name: /öffnen/i })

    // First click → error appears
    fireEvent.click(openBtn)
    await waitFor(() =>
      expect(screen.getByText(/fehler beim laden/i)).toBeInTheDocument()
    )

    // Second click → error disappears before new action
    fireEvent.click(openBtn)
    await waitFor(() =>
      expect(screen.queryByText(/fehler beim laden/i)).not.toBeInTheDocument()
    )
  })

  it('does not trigger extra fetch calls on re-render', async () => {
    setupAccessLevel('immediate')
    const fetchSpy = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ tokens: [] }), { status: 200 }))
    )
    global.fetch = fetchSpy

    const { rerender } = render(<VpDashboardViewPage />)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const countAfterMount = fetchSpy.mock.calls.length

    // Re-render without changing ownerId should not trigger more fetches
    rerender(<VpDashboardViewPage />)
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchSpy.mock.calls.length).toBe(countAfterMount)
  })
})
