import { beforeEach, describe, expect, it, vi } from 'vitest'

const singleMock = vi.fn()
const maybeSingleMock = vi.fn()
let queryBuilder: any
const updateMock = vi.fn(() => queryBuilder)

queryBuilder = {
  select: vi.fn(() => queryBuilder),
  eq: vi.fn(() => queryBuilder),
  in: vi.fn(() => queryBuilder),
  neq: vi.fn(() => queryBuilder),
  ilike: vi.fn(() => queryBuilder),
  update: (...args: unknown[]) => updateMock(...args),
  single: (...args: unknown[]) => singleMock(...args),
  maybeSingle: (...args: unknown[]) => maybeSingleMock(...args),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => queryBuilder),
  })),
}))

describe('/api/invitation security hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects accept when provided email does not match invited email', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'tp-1',
        user_id: 'owner-1',
        email: 'invitee@example.com',
        invitation_status: 'pending',
      },
      error: null,
    })

    const { POST } = await import('@/app/api/invitation/route')
    const response = await POST(
      new Request('http://localhost/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'token-1',
          action: 'accept',
          email: 'attacker@example.com',
        }),
      }),
    )

    expect(response.status).toBe(403)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('accepts invitation without mutating stored email', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'tp-1',
        user_id: 'owner-1',
        email: 'invitee@example.com',
        invitation_status: 'pending',
      },
      error: null,
    })
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'tp-1' }, error: null })

    const { POST } = await import('@/app/api/invitation/route')
    const response = await POST(
      new Request('http://localhost/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'token-1',
          action: 'accept',
          email: 'invitee@example.com',
        }),
      }),
    )

    expect(response.status).toBe(200)
    const updatePayload = updateMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(updatePayload).toBeTruthy()
    expect(updatePayload.invitation_status).toBe('accepted')
    expect(updatePayload.invitation_accepted_at).toBeTypeOf('string')
    expect(updatePayload).not.toHaveProperty('email')
  })

  it('rejects already processed invitations', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'tp-1',
        user_id: 'owner-1',
        email: 'invitee@example.com',
        invitation_status: 'accepted',
      },
      error: null,
    })

    const { POST } = await import('@/app/api/invitation/route')
    const response = await POST(
      new Request('http://localhost/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'token-1',
          action: 'accept',
          email: 'invitee@example.com',
        }),
      }),
    )

    expect(response.status).toBe(409)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('accepts invitation when status is sent (legacy open state)', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'tp-1',
        user_id: 'owner-1',
        email: 'invitee@example.com',
        invitation_status: 'sent',
      },
      error: null,
    })
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'tp-1' }, error: null })

    const { POST } = await import('@/app/api/invitation/route')
    const response = await POST(
      new Request('http://localhost/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'token-1',
          action: 'accept',
          email: 'invitee@example.com',
        }),
      }),
    )

    expect(response.status).toBe(200)
  })

  it('accepts invitation when status is failed (legacy open state)', async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'tp-1',
        user_id: 'owner-1',
        email: 'invitee@example.com',
        invitation_status: 'failed',
      },
      error: null,
    })
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'tp-1' }, error: null })

    const { POST } = await import('@/app/api/invitation/route')
    const response = await POST(
      new Request('http://localhost/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'token-1',
          action: 'accept',
          email: 'invitee@example.com',
        }),
      }),
    )

    expect(response.status).toBe(200)
  })
})
