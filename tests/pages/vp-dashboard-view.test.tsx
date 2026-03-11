import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VpDashboardViewPage from '@/app/(dashboard)/vp-dashboard/view/[ownerId]/page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ ownerId: 'owner-123' }),
}))

const createClientMock = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: createClientMock,
}))

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
  accessLevel = 'immediate',
  shareTokensShouldFail = false,
  downloadResponse,
  bytesResponse,
}: {
  documents?: Array<Record<string, unknown>>
  ownerName?: string
  accessLevel?: string | null
  shareTokensShouldFail?: boolean
  downloadResponse?: () => Promise<Response>
  bytesResponse?: () => Promise<Response>
} = {}) {
  global.fetch = vi.fn((url: string) => {
    if (url.includes('/api/family/view?ownerId=')) {
      return createJsonResponse({ ownerName, accessLevel, documents, categories: {} })
    }

    if (url.includes('/api/documents/share-token/received')) {
      if (shareTokensShouldFail) {
        return Promise.reject(new Error('share-token failed'))
      }

      return createJsonResponse({
        shares: documents
          .filter((doc) => doc.is_encrypted)
          .map((doc) => ({
            owner_id: 'owner-123',
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
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    document.body.innerHTML = ''
  })

  it('shows download button for immediate access when shared documents exist', async () => {
    setupFetch({
      accessLevel: 'immediate',
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /alle herunterladen/i })).toBeInTheDocument()
    )
  })

  it('shows empty state and hides bulk download when no documents are shared', async () => {
    setupFetch({ accessLevel: 'immediate', documents: [] })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByText(/noch keine dokumente/i)).toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
  })

  it('hides download button and shows hint for emergency access', async () => {
    setupFetch({
      accessLevel: 'emergency',
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
    )
    expect(screen.getByText(/notfall-ansicht/i)).toBeInTheDocument()
  })

  it('hides download button for after_confirmation access', async () => {
    setupFetch({
      accessLevel: 'after_confirmation',
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /alle herunterladen/i })).not.toBeInTheDocument()
    )
    expect(screen.getByText(/downloads erfordern eine bestätigung durch den besitzer/i)).toBeInTheDocument()
  })

  it('after_confirmation disables document open action', async () => {
    setupFetch({
      accessLevel: 'after_confirmation',
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /öffnen/i })).toBeDisabled()
    )
    expect(screen.getByText(/bestätigung erforderlich/i)).toBeInTheDocument()
  })

  it('opens visible documents through the bytes endpoint', async () => {
    setupFetch({
      accessLevel: 'emergency',
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
    let bytesCallCount = 0
    setupFetch({
      accessLevel: 'immediate',
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

  it('renders shared documents even when share-token loading fails', async () => {
    setupFetch({
      accessLevel: 'immediate',
      shareTokensShouldFail: true,
      documents: [
        {
          id: 'doc-enc-1',
          title: 'Encrypted Doc',
          category: 'finanzen',
          file_name: 'secret.pdf',
          file_type: 'application/pdf',
          is_encrypted: true,
          file_iv: 'iv-123',
        },
      ],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByTestId('shared-document-doc-enc-1')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /alle herunterladen/i })).toBeInTheDocument()
  })

  it('does not recreate the browser supabase client for access gating', async () => {
    setupFetch({
      accessLevel: 'immediate',
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    render(<VpDashboardViewPage />)

    await waitFor(() =>
      expect(screen.getByTestId('shared-document-doc-1')).toBeInTheDocument()
    )
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('appends a temporary anchor before triggering bulk download', async () => {
    setupFetch({
      accessLevel: 'immediate',
      documents: [{ id: 'doc-1', title: 'Test Doc', category: 'finanzen', file_name: 'test.pdf', file_type: 'application/pdf' }],
    })

    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    render(<VpDashboardViewPage />)

    const button = await screen.findByRole('button', { name: /alle herunterladen/i })
    fireEvent.click(button)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/family/download?ownerId=owner-123'))
    )
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
  })
})
