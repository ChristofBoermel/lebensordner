import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { DocumentAuditLog } from '@/components/settings/document-audit-log'

const limitMock = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const queryBuilder = {
      select: vi.fn(() => queryBuilder),
      eq: vi.fn(() => queryBuilder),
      in: vi.fn(() => queryBuilder),
      order: vi.fn(() => queryBuilder),
      limit: limitMock.mockImplementation(() =>
        Promise.resolve({
          data: [],
          error: null,
        })
      ),
    }

    return {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
        })),
      },
      from: vi.fn(() => queryBuilder),
    }
  },
}))

describe('DocumentAuditLog', () => {
  beforeEach(() => {
    limitMock.mockClear()
  })

  it('loads only latest 5 document security events', async () => {
    render(<DocumentAuditLog />)

    await waitFor(() => {
      expect(limitMock).toHaveBeenCalledWith(5)
    })

    expect(limitMock).not.toHaveBeenCalledWith(100)
  })
})
