import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErinnerungenPage from '@/app/(dashboard)/erinnerungen/page'
import {
  STRIPE_PRICE_BASIC_MONTHLY,
  STRIPE_PRICE_PREMIUM_MONTHLY,
} from '../fixtures/stripe'
import { setMockProfile, resetMockProfile } from '../mocks/supabase'
import { createSupabaseMock } from '../mocks/supabase-client'

type MockReminder = {
  id: string
  title: string
  description: string | null
  due_date: string
  is_completed: boolean
  reminder_type: 'document_expiry' | 'annual_review' | 'custom'
  document_id: string | null
  reminder_watcher_id: string | null
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

const mockTables = {
  reminders: [] as MockReminder[],
  trusted_persons: [] as MockTrustedPerson[],
}

let lastInsertPayload: Record<string, unknown> | null = null

const createMockBuilder = (tableName: string) => {
  const builder: Record<string, any> = {}

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.not = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)

  builder.single = vi.fn(async () => {
    const { mockProfileData } = await import('../mocks/supabase-state')
    return { data: mockProfileData, error: null }
  })

  builder.insert = vi.fn(async (payload: Record<string, unknown>) => {
    lastInsertPayload = payload
    return { data: null, error: null }
  })

  builder.update = vi.fn().mockResolvedValue({ data: null, error: null })
  builder.delete = vi.fn().mockResolvedValue({ data: null, error: null })

  builder.then = (
    onFulfilled?: ((value: { data: unknown[]; error: null }) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => {
    let data: unknown[] = []
    if (tableName === 'reminders') data = mockTables.reminders
    if (tableName === 'trusted_persons') data = mockTables.trusted_persons
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
  }

  return builder
}

const { client: mockSupabaseClient } = createSupabaseMock()

mockSupabaseClient.auth.getUser = async () => ({
  data: { user: { id: 'test-user-id', email: 'test@example.com' } },
  error: null,
})
mockSupabaseClient.from = vi.fn((tableName: string) => createMockBuilder(tableName)) as any

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

const renderPage = async () => {
  render(<ErinnerungenPage />)
  await waitFor(() => {
    expect(screen.getByText(/Erinnerungen & Fristen/i)).toBeInTheDocument()
  })
}

const openDialog = async () => {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Neue Erinnerung/i })).toBeInTheDocument()
  })
  await userEvent.click(screen.getByRole('button', { name: /Neue Erinnerung/i }))
}

describe('Erinnerungen Reminder Watcher Tier Gate', () => {
  beforeEach(() => {
    resetMockProfile()
    mockTables.reminders = []
    mockTables.trusted_persons = []
    lastInsertPayload = null
    global.fetch = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('Free-User sieht keine Watcher-Auswahl', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openDialog()

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Soll eine weitere Person den Termin im Blick haben/i)).not.toBeInTheDocument()
  })

  it('Free-User sieht Upgrade-Hinweis beim Erstellen einer Erinnerung', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openDialog()

    expect(
      screen.getByText(/Upgraden Sie auf Basic oder Premium, um Vertrauenspersonen zu Erinnerungen hinzuzufügen/i)
    ).toBeInTheDocument()
  })

  it('Basic-User sieht Watcher-Auswahl', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
    expect(screen.getByText(/Soll eine weitere Person den Termin im Blick haben/i)).toBeInTheDocument()
  })

  it('Premium-User sieht Watcher-Auswahl', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  it('Basic-User kann Reminder mit Watcher erstellen', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText(/Titel/i), 'Test Reminder')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'tp-1')

    await userEvent.click(screen.getByRole('button', { name: /Speichern/i }))

    await waitFor(() => {
      expect(lastInsertPayload?.reminder_watcher_id).toBe('tp-1')
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/reminder-watcher/notify-reminder',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('Premium-User kann Reminder mit Watcher erstellen', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText(/Titel/i), 'Premium Reminder')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'tp-2')

    await userEvent.click(screen.getByRole('button', { name: /Speichern/i }))

    await waitFor(() => {
      expect(lastInsertPayload?.reminder_watcher_id).toBe('tp-2')
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/reminder-watcher/notify-reminder',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('Watcher-Auswahl versteckt wenn keine Familienmitglieder', async () => {
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = []

    await renderPage()
    await openDialog()

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('Watcher-Select ist auf Mobile nutzbar', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    await renderPage()
    await openDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    expect(select).toHaveClass('w-full')
    expect(select).toHaveClass('h-10')
  })

  it('Upgrade-Hinweis ist auf Mobile lesbar', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openDialog()

    expect(
      screen.getByText(/Upgraden Sie auf Basic oder Premium, um Vertrauenspersonen zu Erinnerungen hinzuzufügen/i)
    ).toBeInTheDocument()
  })

  it('Client-seitige Gate verhindert Watcher-Auswahl für Free-User', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openDialog()

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('Free-User kann manipulierte Watcher-ID nicht speichern oder benachrichtigen', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })
    mockTables.trusted_persons = mockTrustedPersons

    vi.resetModules()
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useState: (initial: unknown) => {
          if (
            initial &&
            typeof initial === 'object' &&
            'reminder_watcher_id' in initial &&
            'title' in initial &&
            'due_date' in initial &&
            'reminder_type' in initial
          ) {
            const [state, setState] = actual.useState({
              ...(initial as Record<string, unknown>),
              reminder_watcher_id: 'tp-1',
            })
            let current = state
            const wrappedSetState = (next: unknown) => {
              const resolved = typeof next === 'function' ? (next as (value: unknown) => unknown)(current) : next
              const nextState = { ...(resolved as Record<string, unknown>), reminder_watcher_id: 'tp-1' }
              current = nextState
              setState(nextState)
            }
            return [state, wrappedSetState]
          }

          return actual.useState(initial)
        },
      }
    })
    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => mockSupabaseClient,
    }))

    const { default: ErinnerungenPageWithManipulatedForm } = await import('@/app/(dashboard)/erinnerungen/page')

    render(<ErinnerungenPageWithManipulatedForm />)
    await waitFor(() => {
      expect(screen.getByText(/Erinnerungen & Fristen/i)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /Neue Erinnerung/i }))
    await userEvent.type(screen.getByLabelText(/Titel/i), 'Manipulated Reminder')
    await userEvent.click(screen.getByRole('button', { name: /Speichern/i }))

    await waitFor(() => {
      expect(lastInsertPayload?.reminder_watcher_id).toBeNull()
    })
    expect(global.fetch).not.toHaveBeenCalled()

    vi.doUnmock('react')
    vi.doUnmock('@/lib/supabase/client')
  })

  it('Tier-Wechsel aktualisiert UI', async () => {
    setMockProfile({ subscription_status: null, stripe_price_id: null })

    await renderPage()
    await openDialog()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Abbrechen/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    cleanup()
    document.body.removeAttribute('data-scroll-locked')
    document.body.style.pointerEvents = ''
    document.body.style.overflow = ''

    setMockProfile({ subscription_status: 'active', stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY })
    mockTables.trusted_persons = mockTrustedPersons

    vi.resetModules()
    vi.doMock('@/lib/subscription-tiers', async () => {
      const actual = await vi.importActual<typeof import('@/lib/subscription-tiers')>('@/lib/subscription-tiers')
      return {
        ...actual,
        getTierFromSubscription: () => actual.SUBSCRIPTION_TIERS.basic,
      }
    })
    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => mockSupabaseClient,
    }))

    const { default: ErinnerungenPageBasic } = await import('@/app/(dashboard)/erinnerungen/page')
    render(<ErinnerungenPageBasic />)
    await waitFor(() => {
      expect(screen.getByText(/Erinnerungen & Fristen/i)).toBeInTheDocument()
    })
    await openDialog()
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    vi.doUnmock('@/lib/subscription-tiers')
    vi.doUnmock('@/lib/supabase/client')
  })
})
