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
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

function setupAccessLevel(level: string) {
  mockSupabase.single = vi.fn(() =>
    Promise.resolve({ data: { access_level: level }, error: null })
  )
}

function createJsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

function setupFetch({
  documents = [],
  ownerName = 'Maria Musterfrau',
  downloadResponse,
  bytesResponse,
}: {
  documents?: Array<Record<string, unknown>>
  ownerName?: string
  downloadResponse?: () => Promise<Response>
  bytesResponse?: () => Promise<Response>
} = {}) {
  global.fetch = vi.fn((url: string) => {
    if (url.includes('/api/family/view?ownerId=')) {
      return createJsonResponse({ ownerName, documents, categories: {} })
    }

    if (url.includes('/api/documents/share-token?ownerId=')) {
      return createJsonResponse({
        tokens: documents
          .filter((doc) => doc.is_encrypted)
          .map((doc) => ({
            document_id: doc.id,
            wrapped_dek_for_tp: `wrapped-${doc.id}`,
          })),
      })
    }

    if (url.includes('/api/family/download?ownerId=')) {
      return downloadResponse
        ? downloadResponse()
        : Promise.resolve(
            new Response(new Blob(['zip']), {
              status: 200,
              headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="test.zip"',
              },
            })
          )
    }

    if (url.includes('/api/family/view/bytes?docId=')) {
      return bytesResponse
        ? bytesResponse()
        : Promise.resolve(new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 }))
    }

    return createJsonResponse({})
  }) as typeof fetch
}

describe('VpDashboardViewPage access level UX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
    window.open = vi.fn()
    mockSupabase.from.mockReturnValue(mockSupabase)
    mockSupabase.select.mockReturnValue(mockSupabase)
    mockSupabase.eq.mockReturnValue(mockSupabase)
  })

  it('shows download button for immediate access when shared documents exist', async () => {
    setupAccessLevel('immediate')
    setupFetch({
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /alle herunterladen/i })).toBeInTheDocument()
    )
  })

  it('shows empty state and hides bulk download when no documents are shared', async () => {
    setupAccessLevel('immediate')
    setupFetch({ documents: [] })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByText(/noch keine dokumente/i)).toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
  })

  it('hides download button and shows hint for emergency access', async () => {
    setupAccessLevel('emergency')
    setupFetch({
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
    )
    expect(screen.getByText(/notfall-ansicht/i)).toBeInTheDocument()
  })

  it('hides download button for after_confirmation access', async () => {
    setupAccessLevel('after_confirmation')
    setupFetch({
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
    )
    expect(screen.getByText(/downloads erfordern eine bestätigung durch den besitzer/i)).toBeInTheDocument()
  })

  it('after_confirmation disables document open action', async () => {
    setupAccessLevel('after_confirmation')
    setupFetch({
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /öffnen/i })).toBeDisabled()
    )
    expect(screen.getByText(/bestätigung erforderlich/i)).toBeInTheDocument()
  })

  it('opens visible documents through the bytes endpoint', async () => {
    setupAccessLevel('emergency')
    setupFetch({
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)
    const openBtn = await screen.findByRole('button', { name: /öffnen/i })

    fireEvent.click(openBtn)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/family/view/bytes?docId=doc-1'))
    )
  })

  it('clears an old error on the next successful action', async () => {
    setupAccessLevel('immediate')

    let bytesCallCount = 0
    setupFetch({
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
      bytesResponse: () => {
        bytesCallCount += 1
        if (bytesCallCount === 1) {
          return Promise.resolve(new Response('', { status: 500 }))
        }
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 }))
      },
    })

    render(<VpDashboardViewPage />)
    const openBtn = await screen.findByRole('button', { name: /öffnen/i })

    fireEvent.click(openBtn)
    await waitFor(() =>
      expect(screen.getByText(/fehler beim laden der datei/i)).toBeInTheDocument()
    )

    fireEvent.click(openBtn)
    await waitFor(() =>
      expect(screen.queryByText(/fehler beim laden der datei/i)).not.toBeInTheDocument()
    )
  })
})
