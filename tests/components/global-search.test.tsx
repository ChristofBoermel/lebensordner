import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlobalSearch } from '@/components/search/global-search'

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

type QueryBuilderState = {
  tableName: string
  selectClause: string
}

const createSupabaseMock = () => {
  const from = vi.fn((tableName: string) => {
    const state: QueryBuilderState = {
      tableName,
      selectClause: '',
    }

    const builder: Record<string, any> = {}
    builder.select = vi.fn((clause: string) => {
      state.selectClause = clause
      return builder
    })
    builder.eq = vi.fn(() => builder)
    builder.or = vi.fn(() => builder)
    builder.not = vi.fn(() => builder)
    builder.limit = vi.fn(async () => {
      if (state.tableName === 'documents' && state.selectClause.includes('notes')) {
        return {
          data: [
            {
              id: 'doc-1',
              title: 'Personalausweis',
              category: 'identitaet',
              notes: 'Wichtiges Dokument',
              metadata: null,
              subcategory_id: 'sub-1',
              custom_category_id: null,
            },
          ],
          error: null,
        }
      }

      if (state.tableName === 'documents') {
        return {
          data: [],
          error: null,
        }
      }

      if (state.tableName === 'trusted_persons') {
        return {
          data: [],
          error: null,
        }
      }

      if (state.tableName === 'reminders') {
        return {
          data: [],
          error: null,
        }
      }

      return {
        data: [],
        error: null,
      }
    })

    return builder
  })

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
    from,
  }
}

const mockSupabaseClient = createSupabaseMock()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

describe('GlobalSearch', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('navigates on mouse click result', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GlobalSearch isOpen onClose={onClose} />)
    await user.type(
      screen.getByPlaceholderText('Dokumente, Personen, Erinnerungen suchen...'),
      'person'
    )

    const resultButton = await screen.findByRole('button', { name: /Personalausweis/i })
    await user.click(resultButton)

    expect(mockPush).toHaveBeenCalledWith('/dokumente?kategorie=identitaet&highlight=doc-1&unterordner=sub-1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates on Enter key for selected result', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GlobalSearch isOpen onClose={onClose} />)
    const input = screen.getByPlaceholderText('Dokumente, Personen, Erinnerungen suchen...')
    await user.type(input, 'person')

    await screen.findByRole('button', { name: /Personalausweis/i })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockPush).toHaveBeenCalledWith('/dokumente?kategorie=identitaet&highlight=doc-1&unterordner=sub-1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('only triggers onClose when dialog is actually closed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GlobalSearch isOpen onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()

    const closeButton = screen.getByText('Schließen', { selector: '.sr-only' }).closest('button')
    expect(closeButton).not.toBeNull()
    await user.click(closeButton!)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
