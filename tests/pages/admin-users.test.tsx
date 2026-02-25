import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminDashboard } from '@/app/(dashboard)/admin/admin-dashboard'
import { createMockPlatformStats } from '../utils/debug-helpers'

let mockStats = createMockPlatformStats()
let mockUsers: any[] = []

describe('Admin User Management', () => {
  beforeEach(() => {
    mockStats = createMockPlatformStats()
    mockUsers = [
      {
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        created_at: '2024-01-15T10:00:00Z',
        onboarding_completed: true,
        subscription_status: 'active',
        storage_used: 52428800,
      },
      {
        id: 'user-2',
        email: 'trial@example.com',
        full_name: 'Trial User',
        role: 'user',
        created_at: '2024-01-10T08:30:00Z',
        onboarding_completed: false,
        subscription_status: 'trialing',
        storage_used: 2048,
      },
      {
        id: 'user-3',
        email: 'free@example.com',
        full_name: 'Free User',
        role: 'admin',
        created_at: '2024-01-05T12:00:00Z',
        onboarding_completed: true,
        subscription_status: null,
        storage_used: 512,
      },
    ]
  })

  it('renders user management table with all columns', () => {
    render(<AdminDashboard initialStats={mockStats} initialUsers={mockUsers} />)

    expect(screen.getByText('Benutzerverwaltung')).toBeInTheDocument()
    expect(screen.getByText('Benutzer')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Abo')).toBeInTheDocument()
    expect(screen.getByText('Speicher')).toBeInTheDocument()
    expect(screen.getByText('Registriert')).toBeInTheDocument()
    expect(screen.getByText('Rolle')).toBeInTheDocument()

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('filters users by search query', async () => {
    render(<AdminDashboard initialStats={mockStats} initialUsers={mockUsers} />)

    const searchInput = screen.getByPlaceholderText(/Nach E-Mail oder Name suchen/i)
    fireEvent.change(searchInput, { target: { value: 'trial' } })
    expect(searchInput).toHaveValue('trial')

    await waitFor(() => {
      expect(screen.getByText('Trial User')).toBeInTheDocument()
      expect(screen.queryByText('Test User')).not.toBeInTheDocument()
    })
  })

  it('shows subscription and onboarding badges', () => {
    render(<AdminDashboard initialStats={mockStats} initialUsers={mockUsers} />)

    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByText('Trial')).toBeInTheDocument()
    expect(screen.getAllByText('Aktiv').length).toBeGreaterThan(0)
    expect(screen.getByText('Onboarding')).toBeInTheDocument()
  })

  it('formats storage values and dates correctly', () => {
    render(<AdminDashboard initialStats={mockStats} initialUsers={mockUsers} />)

    expect(screen.getByText('50.00 MB')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('512 B')).toBeInTheDocument()

    const formattedDate = new Date('2024-01-15T10:00:00Z').toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(screen.getByText(formattedDate)).toBeInTheDocument()
  })

  it('updates role when dropdown changes', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    global.fetch = mockFetch

    render(<AdminDashboard initialStats={mockStats} initialUsers={mockUsers} />)

    const roleSelects = screen.getAllByRole('combobox')
    await user.selectOptions(roleSelects[0], 'admin')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/users/role',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('user-1'),
        })
      )
    })

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.targetUserId).toBe('user-1')
    expect(body.newRole).toBe('admin')
  })

  it('shows empty state when no users found', () => {
    render(<AdminDashboard initialStats={mockStats} initialUsers={[]} />)

    expect(screen.getByText('Keine Benutzer gefunden')).toBeInTheDocument()
  })
})
