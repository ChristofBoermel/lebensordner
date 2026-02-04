// Resend mock fixtures for email testing

export const TEST_EMAIL_ADDRESS = 'test@example.com'
export const TEST_EMAIL_FROM = 'Lebensordner <einladung@lebensordner.org>'

export interface MockEmailResponse {
  id: string
  from: string
  to: string[]
  created_at: string
}

export function createMockEmailResponse(
  success: boolean = true,
  messageId?: string
): MockEmailResponse | null {
  if (!success) {
    return null
  }
  return {
    id: messageId || `msg_test_${Date.now()}`,
    from: TEST_EMAIL_FROM,
    to: [TEST_EMAIL_ADDRESS],
    created_at: new Date().toISOString(),
  }
}

export interface MockResendClientOptions {
  delay?: number
  shouldFail?: boolean
  errorMessage?: string
}

export function createMockResendClient(options: MockResendClientOptions = {}) {
  const { delay = 0, shouldFail = false, errorMessage = 'Failed to send email' } = options

  return {
    emails: {
      send: async (emailData: any) => {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        if (shouldFail) {
          throw new Error(errorMessage)
        }

        return {
          data: createMockEmailResponse(true),
          error: null,
        }
      },
    },
  }
}

export function simulateTimeout(timeoutMs: number = 15000): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Email sending timed out'))
    }, timeoutMs)
  })
}

// Mock trusted person data for testing
export function createMockTrustedPerson(overrides: Partial<MockTrustedPerson> = {}): MockTrustedPerson {
  return {
    id: `tp_test_${Date.now()}`,
    user_id: 'test-user-id',
    name: 'Test Trusted Person',
    email: TEST_EMAIL_ADDRESS,
    phone: null,
    relationship: 'Familie',
    access_level: 'immediate',
    access_delay_hours: 0,
    notes: null,
    is_active: true,
    invitation_token: null,
    invitation_status: 'pending',
    invitation_sent_at: null,
    invitation_accepted_at: null,
    linked_user_id: null,
    email_sent_at: null,
    email_error: null,
    email_retry_count: 0,
    email_status: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export interface MockTrustedPerson {
  id: string
  user_id: string
  name: string
  email: string
  phone: string | null
  relationship: string
  access_level: 'immediate' | 'emergency' | 'after_confirmation'
  access_delay_hours: number
  notes: string | null
  is_active: boolean
  invitation_token: string | null
  invitation_status: 'pending' | 'sent' | 'accepted' | 'declined' | null
  invitation_sent_at: string | null
  invitation_accepted_at: string | null
  linked_user_id: string | null
  email_sent_at: string | null
  email_error: string | null
  email_retry_count: number
  email_status: 'pending' | 'sending' | 'sent' | 'failed' | null
  created_at: string
  updated_at: string
}

// Email retry queue mock data
export interface MockEmailRetryQueueItem {
  id: string
  trusted_person_id: string
  retry_count: number
  last_error: string | null
  next_retry_at: string
  created_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export function createMockEmailRetryQueueItem(
  trustedPersonId: string,
  overrides: Partial<MockEmailRetryQueueItem> = {}
): MockEmailRetryQueueItem {
  return {
    id: `erq_test_${Date.now()}`,
    trusted_person_id: trustedPersonId,
    retry_count: 0,
    last_error: null,
    next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
    created_at: new Date().toISOString(),
    status: 'pending',
    ...overrides,
  }
}
