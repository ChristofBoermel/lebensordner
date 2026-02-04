import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPage from '@/app/(dashboard)/admin/page'
import { createMockPlatformStats } from '../utils/debug-helpers'

let mockRole = 'admin'
let mockStats = createMockPlatformStats()
let mockUsers: any[] = []
let statsError: Error | null = null
let usersError: Error | null = null

const mockRpc = vi.fn(async (fnName: string) => {
  if (fnName === 'get_platform_stats') {
    return { data: statsError ? null : mockStats, error: statsError }
  }
  if (fnName === 'get_all_users') {
    return { data: usersError ? null : mockUsers, error: usersError }
  }
  return { data: null, error: null }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'admin-user-id', email: 'admin@example.com' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { role: mockRole },
            error: null,
          }),
        })),
      })),
    })),
    rpc: mockRpc,
  }),
}))

describe('Admin Dashboard Stats', () => {
  beforeEach(() => {
    mockRole = 'admin'
    mockStats = createMockPlatformStats()
    mockUsers = []
    statsError = null
    usersError = null
    mockRpc.mockClear()
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === 'get_platform_stats') {
        return { data: statsError ? null : mockStats, error: statsError }
      }
      if (fnName === 'get_all_users') {
        return { data: usersError ? null : mockUsers, error: usersError }
      }
      return { data: null, error: null }
    })
  })

  it('denies access to non-admin users', async () => {
    mockRole = 'user'

    render(<AdminPage />)

    await screen.findByText('Zugriff verweigert')
    expect(screen.getByText(/keine Berechtigung/i)).toBeInTheDocument()
  })

  it('renders platform statistics', async () => {
    render(<AdminPage />)

    await screen.findByText('Admin Dashboard')

    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3420')).toBeInTheDocument()
    expect(screen.getByText('1250.5 MB')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
  })

  it('shows loading spinner while fetching data', async () => {
    let resolveStats: (value: { data: any; error: null }) => void
    const statsPromise = new Promise<{ data: any; error: null }>((resolve) => {
      resolveStats = resolve
    })

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_platform_stats') return statsPromise
      if (fnName === 'get_all_users') return Promise.resolve({ data: [], error: null })
      return Promise.resolve({ data: null, error: null })
    })

    const { container } = render(<AdminPage />)

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()

    resolveStats!({ data: mockStats, error: null })
    await screen.findByText('Admin Dashboard')
  })

  it('shows error state when stats fail to load', async () => {
    statsError = new Error('Stats error')

    render(<AdminPage />)

    await screen.findByText(/Statistiken konnten nicht geladen werden/i)
  })

  it('refresh button updates statistics', async () => {
    render(<AdminPage />)

    await screen.findByText('Admin Dashboard')
    expect(screen.getByText('150')).toBeInTheDocument()

    mockStats = createMockPlatformStats({ total_users: 200 })

    const refreshBtn = screen.getByRole('button', { name: /Aktualisieren/i })
    await userEvent.click(refreshBtn)

    await waitFor(() => {
      expect(screen.getByText('200')).toBeInTheDocument()
    })
  })
})
