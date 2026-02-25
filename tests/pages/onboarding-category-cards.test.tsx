import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingPage from '@/app/(dashboard)/onboarding/page'
import { createSupabaseMock } from '../mocks/supabase-client'

const { client: mockSupabaseClient } = createSupabaseMock({
  single: {
    data: {
      onboarding_completed: false,
      first_name: null,
      middle_name: null,
      last_name: null,
      academic_title: null,
      full_name: null,
      phone: null,
      date_of_birth: null,
      address: null,
    },
    error: null,
  },
})

mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-user-id', email: 'test@example.com' } },
  error: null,
})

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

vi.mock('@/lib/posthog', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
  ANALYTICS_EVENTS: {
    ONBOARDING_STARTED: 'onboarding_started',
    ONBOARDING_COMPLETED: 'onboarding_completed',
    ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
    ONBOARDING_STEP_SKIPPED: 'onboarding_step_skipped',
    ERROR_OCCURRED: 'error_occurred',
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/onboarding',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/onboarding/step-feedback-widget', () => ({
  StepFeedbackWidget: ({ open, onSkip }: { open: boolean; onSkip: () => void }) =>
    open ? <button onClick={onSkip}>Feedback überspringen</button> : null,
}))

vi.mock('@/components/onboarding/floating-help-button', () => ({
  FloatingHelpButton: () => null,
}))

vi.mock('@/components/onboarding/checklist-download', () => ({
  ChecklistDownload: () => null,
}))

vi.mock('@/components/onboarding/print-guide', () => ({
  PrintGuide: () => null,
}))

const setMockFetch = () => {
  global.fetch = vi.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/profile/ensure')) {
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    }
    if (url.includes('/api/onboarding/progress')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          progress: {
            currentStep: 'documents',
            profileForm: {
              academic_title: null,
              first_name: '',
              middle_name: null,
              last_name: '',
              phone: '',
              date_of_birth: '',
              address: '',
            },
            emergencyForm: { name: '', phone: '', relationship: '' },
            skippedEmergency: false,
            welcomeNote: '',
            profileFieldIndex: 0,
            emergencyFieldIndex: 0,
            documentCategoriesExpanded: false,
            quickStartMode: false,
          },
        }),
      } as Response)
    }
    if (url.includes('/api/onboarding/feedback')) {
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  }) as unknown as typeof fetch
}

describe('Onboarding Category Cards — T-03', () => {
  beforeEach(() => {
    setMockFetch()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('category cards have overflow-hidden and line-clamp-2 on name text', async () => {
    const { container } = render(<OnboardingPage />)

    // Wait for initialization to complete (loading spinner disappears)
    await waitFor(() => {
      expect(screen.queryByText('Wird geladen...')).not.toBeInTheDocument()
    })

    // Resume dialog appears because saved progress is at the 'documents' step
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Fortsetzen/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /Fortsetzen/i }))

    // Now on documents step — verify category cards
    await waitFor(() => {
      expect(screen.getByText('Ihre Dokumente organisieren')).toBeInTheDocument()
    })

    // Find cards by their class pattern
    const cards = container.querySelectorAll('[class*="rounded-lg"][class*="border-warmgray-300"]')
    expect(cards.length).toBeGreaterThan(0)

    // At least one card has overflow-hidden
    const overflowCards = Array.from(cards).filter(el => el.className.includes('overflow-hidden'))
    expect(overflowCards.length).toBeGreaterThan(0)

    // Category name <p> elements have line-clamp-2
    const nameElements = container.querySelectorAll('p[class*="line-clamp-2"]')
    expect(nameElements.length).toBeGreaterThan(0)
  })
})
