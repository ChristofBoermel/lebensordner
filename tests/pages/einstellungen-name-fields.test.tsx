import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EinstellungenPage from '@/app/(dashboard)/einstellungen/page'
import { createSupabaseMock } from '../mocks/supabase-client'

let mockSeniorMode = false

vi.mock('@/components/theme/theme-provider', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    resolvedTheme: 'light',
    fontSize: 'normal',
    setFontSize: vi.fn(),
    seniorMode: mockSeniorMode,
    setSeniorMode: vi.fn((value: boolean) => {
      mockSeniorMode = value
    }),
  }),
}))

vi.mock('@/components/theme/theme-toggle', () => ({
  ThemeToggle: () => null,
}))

vi.mock('@/components/auth/two-factor-setup', () => ({
  TwoFactorSetup: () => null,
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

const { client: einstellungenClient, getUser: einstellungenGetUser, single: einstellungenSingle, builder: einstellungenBuilder } = createSupabaseMock()

einstellungenGetUser.mockResolvedValue({
  data: { user: { id: 'test-user-id', email: 'test@example.com' } },
  error: null,
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => einstellungenClient,
}))

const baseProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: null,
  first_name: null,
  last_name: null,
  middle_name: null,
  academic_title: null,
  subscription_status: null,
  stripe_price_id: null,
  stripe_customer_id: null,
  storage_used: 0,
  health_data_consent_granted: false,
  two_factor_enabled: false,
  onboarding_completed: true,
  email_reminders_enabled: true,
  email_reminder_days_before: 30,
  sms_reminders_enabled: false,
  sms_reminder_days_before: 3,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const createProfileResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
}) as Response

describe('Einstellungen Name Fields', () => {
  beforeEach(() => {
    mockSeniorMode = false
    vi.clearAllMocks()
    einstellungenGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    })
    global.fetch = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/profile')) {
        return Promise.resolve(createProfileResponse({ profile: {} }))
      }
      if (url.includes('/api/consent')) {
        return Promise.resolve(createProfileResponse({ granted: false }))
      }
      return Promise.resolve(createProfileResponse({}))
    }) as unknown as typeof fetch
  })

  it('name fields render', async () => {
    einstellungenSingle.mockResolvedValue({
      data: { ...baseProfile },
      error: null,
    })

    render(<EinstellungenPage />)

    await screen.findByText('Persönliche Daten')

    expect(screen.getByLabelText('Vorname')).toBeInTheDocument()
    expect(screen.getByLabelText('Nachname')).toBeInTheDocument()
    expect(screen.getByLabelText('Akademischer Titel')).toBeInTheDocument()
  })

  it('save writes structured fields', async () => {
    einstellungenSingle.mockResolvedValue({
      data: { ...baseProfile },
      error: null,
    })

    render(<EinstellungenPage />)

    await screen.findByText('Persönliche Daten')

    const vornameInput = screen.getByLabelText('Vorname')
    const nachnameInput = screen.getByLabelText('Nachname')

    await userEvent.type(vornameInput, 'Max')
    await userEvent.type(nachnameInput, 'Mustermann')

    const saveButtons = screen.getAllByRole('button', { name: /Änderungen speichern/i })
    await userEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(einstellungenBuilder.update).toHaveBeenCalled()
    })

    const updateArg = (einstellungenBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.first_name).toBe('Max')
    expect(updateArg.last_name).toBe('Mustermann')
    expect(updateArg.full_name).toBeTruthy()
  })

  it('existing user with only full_name sees empty new fields', async () => {
    einstellungenSingle.mockResolvedValue({
      data: { ...baseProfile, full_name: 'Max Mustermann', first_name: null, last_name: null, academic_title: null, middle_name: null },
      error: null,
    })

    render(<EinstellungenPage />)

    await screen.findByText('Persönliche Daten')

    expect(screen.getByLabelText('Vorname')).toHaveValue('')
  })
})
