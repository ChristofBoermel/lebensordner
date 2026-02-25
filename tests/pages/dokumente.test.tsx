import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsPage from '@/app/(dashboard)/dokumente/page'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
} from '../fixtures/stripe'
import { setMockProfile, resetMockProfile } from '../mocks/supabase'
import { createSupabaseMock } from '../mocks/supabase-client'

type MockDocument = {
  id: string
  title: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  category: string
  subcategory_id: string | null
  custom_category_id: string | null
  expiry_date: string | null
  notes: string | null
  created_at: string
}

type MockTrustedPerson = {
  id: string
  name: string
  email: string
  linked_user_id: string | null
}

const mockTrustedPersons: MockTrustedPerson[] = [
  { id: 'tp-1', name: 'Anna Schmidt', email: 'anna@example.com', linked_user_id: 'linked-1' },
  { id: 'tp-2', name: 'Max Mustermann', email: 'max@example.com', linked_user_id: 'linked-2' },
]

const mockPendingTrustedPersons: MockTrustedPerson[] = [
  { id: 'tp-pending-1', name: 'Pending User', email: 'pending@example.com', linked_user_id: null },
]

const mockTables = {
  documents: [] as MockDocument[],
  trusted_persons: [] as MockTrustedPerson[],
  subcategories: [] as { id: string; name: string; parent_category: string }[],
  custom_categories: [] as { id: string; name: string }[],
}

let lastInsertPayload: Record<string, unknown> | null = null
let lastUploadFormData: FormData | null = null
let lastUploadDocument: Record<string, unknown> | null = null
let mockUploadDocument: Record<string, unknown> | null = null
let trustedPersonsQueryCount = 0

const createMockBuilder = (tableName: string) => {
  const builder: Record<string, any> = {}

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.not = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.ilike = vi.fn(() => builder)

  builder.single = vi.fn(async () => {
    const { mockProfileData } = await import('../mocks/supabase-state')
    if (tableName === 'profiles') {
      return { data: mockProfileData, error: null }
    }
    return { data: null, error: null }
  })

  builder.insert = vi.fn((payload: Record<string, unknown>) => {
    lastInsertPayload = payload
    const insertedRow = { id: `inserted-${tableName}`, ...payload }
    return {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
      })),
    }
  })

  builder.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  })
  builder.delete = vi.fn().mockResolvedValue({ data: null, error: null })

  builder.then = (
    onFulfilled?: ((value: { data: unknown[]; error: null }) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => {
    let data: unknown[] = []
    if (tableName === 'documents') data = mockTables.documents
    if (tableName === 'subcategories') data = mockTables.subcategories
    if (tableName === 'custom_categories') data = mockTables.custom_categories
    if (tableName === 'trusted_persons') {
      data = mockTables.trusted_persons.filter((tp) => tp.linked_user_id)
    }
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
  }

  return builder
}

const { client: mockSupabaseClient } = createSupabaseMock()

mockSupabaseClient.auth.getUser = async () => ({
  data: { user: { id: 'test-user-id', email: 'test@example.com' } },
  error: null,
})
mockSupabaseClient.from = vi.fn((tableName: string) => {
  if (tableName === 'trusted_persons') {
    trustedPersonsQueryCount += 1
  }
  return createMockBuilder(tableName)
}) as any

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

vi.mock('@/lib/vault/VaultContext', () => ({
  useVault: () => ({
    isSetUp: false,
    isUnlocked: true,
    masterKey: null,
    setup: vi.fn(),
    unlock: vi.fn(),
    unlockWithRecovery: vi.fn(),
    lock: vi.fn(),
  }),
}))

vi.mock('@/lib/posthog', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
  ANALYTICS_EVENTS: {
    DOCUMENT_UPLOADED: 'document_uploaded',
    ERROR_OCCURRED: 'error_occurred',
  },
}))

vi.mock('@/components/ui/file-upload', () => ({
  FileUpload: ({ onFileSelect }: { onFileSelect: (file: File) => void }) => (
    <input
      type="file"
      data-testid="file-input"
      onChange={(event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (file) onFileSelect(file)
      }}
    />
  ),
}))

vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) => (
    <input
      data-testid="expiry-date-input"
      value={value}
      onChange={(event) => onChange((event.target as HTMLInputElement).value)}
    />
  ),
}))

const setMockFetch = () => {
  global.fetch = vi.fn((input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/documents/upload')) {
      const body = init?.body
      if (body instanceof FormData) {
        lastUploadFormData = body
      }
      const reminderWatcherId =
        lastUploadFormData?.get('reminder_watcher_id')?.toString() ?? null
      const responseDocument =
        mockUploadDocument ?? {
          id: 'doc-1',
          reminder_watcher_id: reminderWatcherId,
        }
      lastUploadDocument = responseDocument
      return Promise.resolve({
        ok: true,
        json: async () => ({
          path: 'test/path/file.pdf',
          size: 1024,
          document: responseDocument,
        }),
      } as Response)
    }
    if (url.includes('/api/reminder-watcher/notify')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    } as Response)
  }) as unknown as typeof fetch
}

const renderPage = async () => {
  render(<DocumentsPage />)
  await waitFor(() => {
    expect(
      screen.getByRole('heading', { name: /Dokumente/i })
    ).toBeInTheDocument()
  })
}

const openUploadDialog = async () => {
  await waitFor(() => {
    expect(
      screen.getAllByRole('button', { name: /Dokument hinzufügen/i }).length
    ).toBeGreaterThan(0)
  })
  await userEvent.click(
    screen.getAllByRole('button', { name: /Dokument hinzufügen/i })[0]
  )
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
}

const setExpiryDate = async (value: string) => {
  const input = await screen.findByTestId('expiry-date-input')
  fireEvent.change(input, { target: { value } })
  await waitFor(() => {
    expect(input).toHaveValue(value)
  })
}

const uploadTestFile = async () => {
  const fileInput = screen.getByTestId('file-input')
  const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
  await userEvent.upload(fileInput, file)
}

describe('Dokumente Upload - Reminder Watcher Tier Gate', () => {
  beforeEach(() => {
    resetMockProfile()
    mockTables.documents = []
    mockTables.trusted_persons = []
    mockTables.subcategories = []
    mockTables.custom_categories = []
    lastInsertPayload = null
    lastUploadFormData = null
    lastUploadDocument = null
    mockUploadDocument = null
    trustedPersonsQueryCount = 0
    setMockFetch()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('Free-User sieht Upgrade-Hinweis bei Ablaufdatum', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    expect(screen.getByTestId('reminder-watcher-upgrade-hint')).toBeInTheDocument()
  })

  it('Free-User sieht keine Watcher-Auswahl', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    expect(screen.queryByTestId('reminder-watcher-select')).not.toBeInTheDocument()
  })

  it('Basic-User sieht Watcher-Auswahl bei Ablaufdatum', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
  })

  it('Premium-User sieht Watcher-Auswahl bei Ablaufdatum', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
  })

  it('Watcher-Auswahl bleibt ohne Ablaufdatum verborgen (alle Tiers)', async () => {
    const tiers = [
      { status: null, price: null },
      { status: 'active', price: STRIPE_PRICE_BASIC_MONTHLY },
      { status: 'active', price: STRIPE_PRICE_PREMIUM_MONTHLY },
    ]

    for (const tier of tiers) {
      resetMockProfile()
      setMockProfile({ subscription_status: tier.status, stripe_price_id: tier.price })
      mockTables.trusted_persons = mockTrustedPersons

      const { unmount } = render(<DocumentsPage />)
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Dokumente/i })
        ).toBeInTheDocument()
      })
      await openUploadDialog()

      expect(screen.queryByTestId('reminder-watcher-select')).not.toBeInTheDocument()

      unmount()
    }
  })

  it('Watcher-Auswahl bleibt bei fehlenden Familienmitgliedern verborgen (Basic/Premium)', async () => {
    const tiers = [
      { status: 'active', price: STRIPE_PRICE_BASIC_MONTHLY },
      { status: 'active', price: STRIPE_PRICE_PREMIUM_MONTHLY },
    ]

    for (const tier of tiers) {
      resetMockProfile()
      setMockProfile({ subscription_status: tier.status, stripe_price_id: tier.price })
      mockTables.trusted_persons = []

      const { unmount } = render(<DocumentsPage />)
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Dokumente/i })
        ).toBeInTheDocument()
      })
      await openUploadDialog()
      await setExpiryDate('2030-01-01')

      expect(screen.queryByTestId('reminder-watcher-select')).not.toBeInTheDocument()

      unmount()
    }
  })

  it('Basic-User kann Watcher auswählen und Dokument hochladen', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await uploadTestFile()
    await setExpiryDate('2030-01-01')

    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
    await userEvent.selectOptions(screen.getByTestId('reminder-watcher-select'), 'tp-1')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toHaveValue('tp-1')
    })
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(lastUploadFormData?.get('reminder_watcher_id')).toBe('tp-1')
    })
  })

  it('Premium-User kann Watcher auswählen und Dokument hochladen', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await uploadTestFile()
    await setExpiryDate('2030-01-01')

    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
    await userEvent.selectOptions(screen.getByTestId('reminder-watcher-select'), 'tp-2')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toHaveValue('tp-2')
    })
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(lastUploadFormData?.get('reminder_watcher_id')).toBe('tp-2')
    })
  })

  it('Watcher-Notification API wird nach erfolgreichem Upload aufgerufen', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await uploadTestFile()
    await setExpiryDate('2030-01-01')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
    await userEvent.selectOptions(screen.getByTestId('reminder-watcher-select'), 'tp-1')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toHaveValue('tp-1')
    })
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/reminder-watcher/notify',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('Dokument wird mit korrekter reminder_watcher_id gespeichert', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await uploadTestFile()
    await setExpiryDate('2030-01-01')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
    await userEvent.selectOptions(screen.getByTestId('reminder-watcher-select'), 'tp-2')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toHaveValue('tp-2')
    })
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(lastUploadDocument?.reminder_watcher_id).toBe('tp-2')
    })
  })

  it('Free-User Insert setzt reminder_watcher_id auf null', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openUploadDialog()
    await uploadTestFile()
    await setExpiryDate('2030-01-01')
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(lastUploadFormData?.get('reminder_watcher_id')).toBeNull()
    })
  })

  it('Client-Gate verhindert Watcher-Auswahl für Free-User', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    expect(screen.queryByTestId('reminder-watcher-select')).not.toBeInTheDocument()
  })

  it('Watcher-Select ist auf Mobile nutzbar', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
    const select = screen.getByTestId('reminder-watcher-select')
    expect(select).toHaveClass('w-full')
    expect(select).toHaveClass('h-10')
  })

  it('Upgrade-Hinweis ist auf Mobile lesbar', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    expect(screen.getByTestId('reminder-watcher-upgrade-hint')).toBeInTheDocument()
  })

  it('Upload-Dialog ist auf Mobile vollhöhe (h-[100dvh])', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })

    await renderPage()
    await openUploadDialog()

    expect(screen.getByRole('dialog')).toHaveClass('h-[100dvh]')
  })

  it('Tier-Upgrade von Free auf Basic zeigt Watcher-Auswahl', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    const { rerender } = render(<DocumentsPage />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dokumente/i })
      ).toBeInTheDocument()
    })
    await openUploadDialog()
    await setExpiryDate('2030-01-01')
    expect(screen.queryByTestId('reminder-watcher-select')).not.toBeInTheDocument()

    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    rerender(<DocumentsPage key="tier-basic" />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dokumente/i })
      ).toBeInTheDocument()
    })
    await openUploadDialog()
    await setExpiryDate('2030-01-01')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
  })

  it('Tier-Downgrade von Basic auf Free versteckt Watcher-Auswahl', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    const { rerender } = render(<DocumentsPage />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dokumente/i })
      ).toBeInTheDocument()
    })
    await openUploadDialog()
    await setExpiryDate('2030-01-01')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })

    setMockProfile({ subscription_status: null, stripe_price_id: null })
    rerender(<DocumentsPage key="tier-free" />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dokumente/i })
      ).toBeInTheDocument()
    })
    await openUploadDialog()
    await setExpiryDate('2030-01-01')
    expect(screen.queryByTestId('reminder-watcher-select')).not.toBeInTheDocument()
  })

  it('Leere Familienmitglied-Liste versteckt Watcher-Auswahl', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockPendingTrustedPersons

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')

    expect(screen.queryByTestId('reminder-watcher-select')).not.toBeInTheDocument()
  })

  it('Watcher-Auswahl wird zurückgesetzt, wenn Ablaufdatum gelöscht wird', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openUploadDialog()
    await setExpiryDate('2030-01-01')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toBeInTheDocument()
    })
    await userEvent.selectOptions(screen.getByTestId('reminder-watcher-select'), 'tp-1')
    await waitFor(() => {
      expect(screen.getByTestId('reminder-watcher-select')).toHaveValue('tp-1')
    })

    await setExpiryDate('')
    await setExpiryDate('2030-01-02')

    expect(screen.getByTestId('reminder-watcher-select')).toHaveValue('_none')
  })

  it('Familienmitglieder werden nur einmal geladen', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()

    await waitFor(() => {
      expect(trustedPersonsQueryCount).toBe(1)
    })
  })

  it('Tier-Updates verursachen keine erneute Familienmitglieder-Abfrage', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    const { rerender } = render(<DocumentsPage />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dokumente/i })
      ).toBeInTheDocument()
    })

    const initialCount = trustedPersonsQueryCount
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY })
    rerender(<DocumentsPage />)

    expect(trustedPersonsQueryCount).toBe(initialCount)
  })

  it('Free-User kann manipulierte Watcher-ID nicht speichern', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })
    mockTables.trusted_persons = mockTrustedPersons
    mockUploadDocument = { id: 'doc-1', reminder_watcher_id: null }

    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      let callIndex = 0
      return {
        ...actual,
        useState: (initial: unknown) => {
          callIndex += 1
          if (callIndex === 42) {
            const [state, setState] = actual.useState('tp-1')
            const wrappedSetState = () => setState('tp-1')
            return [state, wrappedSetState]
          }
          return actual.useState(initial)
        },
      }
    })
    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => mockSupabaseClient,
    }))

    const { default: DocumentsPageWithManipulatedWatcher } = await import('@/app/(dashboard)/dokumente/page')

    render(<DocumentsPageWithManipulatedWatcher />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dokumente/i })
      ).toBeInTheDocument()
    })
    await openUploadDialog()
    await uploadTestFile()
    await setExpiryDate('2030-01-01')
    await userEvent.click(screen.getByRole('button', { name: /Hinzufügen/i }))

    await waitFor(() => {
      expect(lastUploadFormData?.get('reminder_watcher_id')).toBe('tp-1')
      expect(lastUploadDocument?.reminder_watcher_id).toBeNull()
    })

    vi.doUnmock('react')
    vi.doUnmock('@/lib/supabase/client')
  })
})

describe('Dokumente Suche', () => {
  beforeEach(() => {
    resetMockProfile()
    mockTables.documents = []
    mockTables.trusted_persons = []
    mockTables.subcategories = []
    mockTables.custom_categories = []
    lastInsertPayload = null
    lastUploadFormData = null
    lastUploadDocument = null
    mockUploadDocument = null
    trustedPersonsQueryCount = 0
    setMockFetch()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('filtert Dokumente im Überblick nach Suche', async () => {
    mockTables.documents = [
      {
        id: 'doc-1',
        title: 'Reisepass',
        file_name: 'reisepass.pdf',
        file_path: '/docs/reisepass.pdf',
        file_type: 'application/pdf',
        file_size: 1234,
        category: 'identitaet',
        subcategory_id: null,
        custom_category_id: null,
        expiry_date: null,
        notes: null,
        created_at: '2025-01-01T10:00:00.000Z',
      },
      {
        id: 'doc-2',
        title: 'Führerschein',
        file_name: 'fuehrerschein.pdf',
        file_path: '/docs/fuehrerschein.pdf',
        file_type: 'application/pdf',
        file_size: 2345,
        category: 'identitaet',
        subcategory_id: null,
        custom_category_id: null,
        expiry_date: null,
        notes: null,
        created_at: '2025-01-02T10:00:00.000Z',
      },
      {
        id: 'doc-3',
        title: 'Steuerbescheid',
        file_name: 'steuerbescheid.pdf',
        file_path: '/docs/steuerbescheid.pdf',
        file_type: 'application/pdf',
        file_size: 3456,
        category: 'finanzen',
        subcategory_id: null,
        custom_category_id: null,
        expiry_date: null,
        notes: null,
        created_at: '2025-01-03T10:00:00.000Z',
      },
    ]

    await renderPage()

    const searchInput = screen.getByPlaceholderText('Dokumente durchsuchen...')
    await userEvent.type(searchInput, 'Reise')

    await waitFor(() => {
      expect(screen.getByText('Reisepass')).toBeInTheDocument()
    })
    expect(screen.queryByText('Führerschein')).not.toBeInTheDocument()
    expect(screen.queryByText('Steuerbescheid')).not.toBeInTheDocument()

    await userEvent.clear(searchInput)

    await waitFor(() => {
      expect(screen.getByText('Führerschein')).toBeInTheDocument()
    })
    expect(screen.getByText('Steuerbescheid')).toBeInTheDocument()
  })
})

describe('Dokumente Kategorien — Vollmachten & Testament', () => {
  beforeEach(() => {
    resetMockProfile()
    mockTables.documents = []
    mockTables.trusted_persons = []
    mockTables.subcategories = []
    mockTables.custom_categories = []
    lastInsertPayload = null
    lastUploadFormData = null
    lastUploadDocument = null
    mockUploadDocument = null
    trustedPersonsQueryCount = 0
    setMockFetch()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('"Vollmachten" erscheint in der Kategorie-Übersicht', async () => {
    await renderPage()

    expect(screen.getAllByText('Vollmachten').length).toBeGreaterThan(0)
  })

  it('"Bevollmächtigungen" erscheint nicht mehr', async () => {
    await renderPage()

    expect(screen.queryByText('Bevollmächtigungen')).toBeNull()
  })

  it('"Testament" erscheint in der Kategorie-Übersicht', async () => {
    await renderPage()

    expect(screen.getAllByText('Testament').length).toBeGreaterThan(0)
  })

  it('Dokument mit category="bevollmaechtigungen" wird unter "Vollmachten" angezeigt', async () => {
    mockTables.documents = [
      {
        id: 'doc-vollmacht-1',
        title: 'Vorsorgevollmacht',
        file_name: 'vorsorgevollmacht.pdf',
        file_path: '/docs/vorsorgevollmacht.pdf',
        file_type: 'application/pdf',
        file_size: 1234,
        category: 'bevollmaechtigungen',
        subcategory_id: null,
        custom_category_id: null,
        expiry_date: null,
        notes: null,
        created_at: '2025-01-01T10:00:00.000Z',
      },
    ]

    await renderPage()

    const vollmachtenCards = screen.getAllByText('Vollmachten')
    await userEvent.click(vollmachtenCards[0])

    await waitFor(() => {
      expect(screen.getByText('Vorsorgevollmacht')).toBeInTheDocument()
    })
  })
})

describe('Dokumente UI Fixes — T-03', () => {
  beforeEach(() => {
    resetMockProfile()
    mockTables.documents = []
    mockTables.trusted_persons = []
    mockTables.subcategories = []
    mockTables.custom_categories = []
    lastInsertPayload = null
    lastUploadFormData = null
    lastUploadDocument = null
    mockUploadDocument = null
    trustedPersonsQueryCount = 0
    setMockFetch()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('search bar switches to overview tab when user types while on a category tab', async () => {
    mockTables.documents = [
      {
        id: 'doc-reisepass',
        title: 'Reisepass',
        file_name: 'reisepass.pdf',
        file_path: 'test/reisepass.pdf',
        file_type: 'application/pdf',
        file_size: 1234,
        category: 'identitaet',
        subcategory_id: null,
        custom_category_id: null,
        expiry_date: null,
        notes: null,
        created_at: '2025-01-01T10:00:00.000Z',
      },
      {
        id: 'doc-steuer',
        title: 'Steuerbescheid',
        file_name: 'steuerbescheid.pdf',
        file_path: 'test/steuerbescheid.pdf',
        file_type: 'application/pdf',
        file_size: 2345,
        category: 'finanzen',
        subcategory_id: null,
        custom_category_id: null,
        expiry_date: null,
        notes: null,
        created_at: '2025-01-02T10:00:00.000Z',
      },
    ]

    await renderPage()

    const identitaetTab = screen.getByRole('tab', { name: /Identität/i })
    await userEvent.click(identitaetTab)

    const searchInput = screen.getByPlaceholderText('Dokumente durchsuchen...')
    await userEvent.type(searchInput, 'Reise')

    await waitFor(() => {
      expect(screen.getByText('Suchergebnisse')).toBeInTheDocument()
      expect(screen.getByText('Reisepass')).toBeInTheDocument()
    })

    expect(screen.queryByText('Steuerbescheid')).not.toBeInTheDocument()
  })

  it('custom categories section is visible when custom categories exist', async () => {
    mockTables.custom_categories = [
      { id: 'cat-1', name: 'Meine Kategorie', description: 'Test' } as any,
    ]

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Eigene Kategorien')).toBeInTheDocument()
      expect(screen.getByText('Meine Kategorie')).toBeInTheDocument()
    })
  })

  it('upload dialog has scroll indicator gradient and correct header padding', async () => {
    await renderPage()
    await openUploadDialog()

    const dialog = screen.getByRole('dialog')

    const dialogHeader = dialog.querySelector('[class*="p-6"]')
    expect(dialogHeader?.className).toContain('pr-14')

    const gradient = dialog.querySelector('[class*="bg-gradient-to-t"]')
    expect(gradient).toBeInTheDocument()
  })

  it('Upload-Dialog hat sm:max-h-[90vh] Klasse für bounded height auf Desktop', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })

    await renderPage()
    await openUploadDialog()

    expect(screen.getByRole('dialog')).toHaveClass('sm:max-h-[90vh]')
  })

  it('Schließen-Button liegt nicht innerhalb des scrollbaren Bereichs', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })

    await renderPage()
    await openUploadDialog()

    const dialog = screen.getByRole('dialog')
    const scrollDiv = dialog.querySelector('[class*="overflow-y-auto"]')
    const closeButton = screen.getByText('Schließen', { selector: '.sr-only' })?.closest('button')

    expect(scrollDiv).toBeInTheDocument()
    expect(closeButton).toBeInTheDocument()
    expect(scrollDiv?.contains(closeButton)).toBe(false)
  })
})

// ── T-14: Dokumente Bulk-Action Bar ────────────────────────────────────────

let bulkShareDialogProps: Record<string, unknown> | null = null

vi.mock('@/components/sharing/BulkShareDialog', () => ({
  BulkShareDialog: (props: {
    isOpen: boolean
    documents: Array<{ id: string; title: string; wrapped_dek: string | null }>
    trustedPersons: Array<{ id: string; name: string; linked_user_id: string | null }>
    onClose: () => void
    onSuccess: () => void
    onRequestVaultUnlock: () => void
  }) => {
    bulkShareDialogProps = props as unknown as Record<string, unknown>
    return (
      <div
        data-testid="bulk-share-dialog"
        data-open={props.isOpen ? 'true' : 'false'}
      />
    )
  },
}))

const mockDocBulk = {
  id: 'doc-bulk-1',
  title: 'Reisepass',
  file_name: 'reisepass.pdf',
  file_path: 'test/reisepass.pdf',
  file_type: 'application/pdf',
  file_size: 1234,
  category: 'identitaet',
  subcategory_id: null,
  custom_category_id: null,
  expiry_date: null,
  notes: null,
  created_at: '2025-01-01T10:00:00.000Z',
}

describe('Dokumente Bulk-Action Bar — T-14', () => {
  beforeEach(() => {
    resetMockProfile()
    mockTables.documents = [mockDocBulk]
    mockTables.trusted_persons = mockTrustedPersons
    mockTables.subcategories = []
    mockTables.custom_categories = []
    lastInsertPayload = null
    lastUploadFormData = null
    lastUploadDocument = null
    mockUploadDocument = null
    trustedPersonsQueryCount = 0
    bulkShareDialogProps = null
    setMockFetch()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const selectFirstDocument = async () => {
    await renderPage()
    // Navigate into a category so the document list is visible
    const identitaetCards = screen.getAllByText('Identität')
    await userEvent.click(identitaetCards[0])
    await waitFor(() => {
      expect(screen.getByText('Reisepass')).toBeInTheDocument()
    })
    // Click the checkbox button (first button inside the document-item)
    const docItem = screen.getByText('Reisepass').closest('.document-item')!
    const checkbox = docItem.querySelector('button')!
    await userEvent.click(checkbox)
    await waitFor(() => {
      expect(screen.getByTestId('bulk-share-dialog')).toBeInTheDocument()
    })
  }

  it('Bulk-Action-Bar ist zentriert (left-1/2, -translate-x-1/2, kein inset-x-4)', async () => {
    await selectFirstDocument()

    const bar = screen
      .getByTestId('bulk-share-dialog')
      .closest('body')!
      .querySelector('.fixed.left-1\\/2.-translate-x-1\\/2') as HTMLElement | null

    // The bar container should be found in the document
    const allFixed = document.querySelectorAll('.fixed')
    const actionBar = Array.from(allFixed).find(
      (el) => el.className.includes('left-1/2') && el.className.includes('-translate-x-1/2')
    ) as HTMLElement | undefined

    expect(actionBar).toBeTruthy()
    expect(actionBar!.className).toContain('left-1/2')
    expect(actionBar!.className).toContain('-translate-x-1/2')
    expect(actionBar!.className).not.toContain('inset-x-4')
  })

  it('"Teilen"-Button ist in der Bulk-Action-Bar sichtbar', async () => {
    await selectFirstDocument()

    expect(screen.getByRole('button', { name: /Teilen/i })).toBeInTheDocument()
  })

  it('"Teilen" öffnet BulkShareDialog', async () => {
    await selectFirstDocument()

    await userEvent.click(screen.getByRole('button', { name: /Teilen/i }))

    await waitFor(() => {
      expect(screen.getByTestId('bulk-share-dialog')).toHaveAttribute('data-open', 'true')
    })
  })

  it('BulkShareDialog erhält die ausgewählten Dokumente', async () => {
    await selectFirstDocument()

    await userEvent.click(screen.getByRole('button', { name: /Teilen/i }))

    await waitFor(() => {
      expect(bulkShareDialogProps).not.toBeNull()
    })

    const docs = bulkShareDialogProps!.documents as Array<{ id: string }>
    expect(docs.some((d) => d.id === 'doc-bulk-1')).toBe(true)
  })

  it('Verschieben und Auswahl-aufheben Buttons bleiben neben Teilen sichtbar', async () => {
    await selectFirstDocument()

    expect(screen.getByRole('button', { name: /Verschieben/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Auswahl aufheben/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Teilen/i })).toBeInTheDocument()
  })
})
