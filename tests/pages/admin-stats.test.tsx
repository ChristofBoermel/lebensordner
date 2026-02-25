import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminDashboard } from '@/app/(dashboard)/admin/admin-dashboard'
import { ForbiddenPage } from '@/components/error/forbidden-page'
import { createMockPlatformStats } from '../utils/debug-helpers'

// Stable router mock so component and test share the same refresh fn
const mockRouterObj = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouterObj,
  redirect: vi.fn(),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}))

let mockStats = createMockPlatformStats()

describe('Admin Dashboard Stats', () => {
  beforeEach(() => {
    mockStats = createMockPlatformStats()
  })

  it('denies access to non-admin users', () => {
    render(<ForbiddenPage />)

    expect(screen.getByText('Zugriff verweigert')).toBeInTheDocument()
    expect(screen.getByText(/keine Berechtigung/i)).toBeInTheDocument()
  })

  it('renders platform statistics', () => {
    render(<AdminDashboard initialStats={mockStats} initialUsers={[]} />)

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3420')).toBeInTheDocument()
    expect(screen.getByText('1250.5 MB')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
  })

  it('refresh button updates statistics', async () => {
    render(<AdminDashboard initialStats={mockStats} initialUsers={[]} />)

    const refreshBtn = screen.getByRole('button', { name: /Aktualisieren/i })
    await userEvent.click(refreshBtn)

    expect(mockRouterObj.refresh).toHaveBeenCalled()
  })
})
