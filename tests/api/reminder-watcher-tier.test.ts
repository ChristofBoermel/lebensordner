import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_BASIC_MONTHLY,
} from '../fixtures/stripe'

const mockResendSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockResendSend },
  })),
}))

let mockProfileConfig = {
  subscription_status: null as string | null,
  stripe_price_id: null as string | null,
}

let mockAuthUser: { id: string; email: string } | null = {
  id: 'test-user-id',
  email: 'owner@example.com',
}

const createMockSupabaseClient = () => {
  const mockProfile = {
    id: 'test-user-id',
    full_name: 'Test Owner',
    email: 'owner@example.com',
    ...mockProfileConfig,
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    })),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(createMockSupabaseClient())),
}))

function setFreeUser() {
  mockProfileConfig = {
    subscription_status: null,
    stripe_price_id: null,
  }
}

function setBasicUser() {
  mockProfileConfig = {
    subscription_status: 'active',
    stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
  }
}

function setPremiumUser() {
  mockProfileConfig = {
    subscription_status: 'active',
    stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
  }
}

describe('Reminder Watcher Notify API - Tier Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFreeUser()
    mockAuthUser = { id: 'test-user-id', email: 'owner@example.com' }
    process.env.RESEND_API_KEY = 'test-resend-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should reject Free users with 403', async () => {
    setFreeUser()
    vi.resetModules()
    const { POST } = await import('@/app/api/reminder-watcher/notify/route')

    const request = new Request('http://localhost/api/reminder-watcher/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'doc-1',
        documentTitle: 'Test Dokument',
        category: 'family',
        expiryDate: '2030-01-01',
        watcherEmail: 'watcher@example.com',
        watcherName: 'Watcher',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Basic- und Premium')
  })

  it('should allow Basic users', async () => {
    setBasicUser()
    mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

    vi.resetModules()
    const { POST } = await import('@/app/api/reminder-watcher/notify/route')

    const request = new Request('http://localhost/api/reminder-watcher/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'doc-1',
        documentTitle: 'Test Dokument',
        category: 'family',
        expiryDate: '2030-01-01',
        watcherEmail: 'watcher@example.com',
        watcherName: 'Watcher',
      }),
    })

    const response = await POST(request)

    expect(response.status).not.toBe(403)
  })

  it('should allow Premium users', async () => {
    setPremiumUser()
    mockResendSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

    vi.resetModules()
    const { POST } = await import('@/app/api/reminder-watcher/notify/route')

    const request = new Request('http://localhost/api/reminder-watcher/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'doc-1',
        documentTitle: 'Test Dokument',
        category: 'family',
        expiryDate: '2030-01-01',
        watcherEmail: 'watcher@example.com',
        watcherName: 'Watcher',
      }),
    })

    const response = await POST(request)

    expect(response.status).not.toBe(403)
  })

  it('should reject unauthenticated users with 401', async () => {
    mockAuthUser = null
    vi.resetModules()
    const { POST } = await import('@/app/api/reminder-watcher/notify/route')

    const request = new Request('http://localhost/api/reminder-watcher/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'doc-1',
        documentTitle: 'Test Dokument',
        category: 'family',
        expiryDate: '2030-01-01',
        watcherEmail: 'watcher@example.com',
        watcherName: 'Watcher',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toContain('Nicht angemeldet')
  })
})
