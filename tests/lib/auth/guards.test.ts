import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  requireAuth,
  requireAdmin,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/guards'

// Mock logSecurityEvent
const mockLogSecurityEvent = vi.fn()
vi.mock('@/lib/security/audit-log', () => ({
  logSecurityEvent: (...args: any[]) => mockLogSecurityEvent(...args),
  EVENT_UNAUTHORIZED_ACCESS: 'unauthorized_access',
}))

// Mock Supabase client
const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
      from: mockFrom,
    })
  ),
}))

describe('guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UnauthorizedError', () => {
    it('should have statusCode 401', () => {
      const error = new UnauthorizedError()
      expect(error.statusCode).toBe(401)
      expect(error.message).toBe('Not authenticated')
      expect(error.name).toBe('UnauthorizedError')
    })

    it('should accept custom message', () => {
      const error = new UnauthorizedError('Custom message')
      expect(error.message).toBe('Custom message')
    })
  })

  describe('ForbiddenError', () => {
    it('should have statusCode 403', () => {
      const error = new ForbiddenError()
      expect(error.statusCode).toBe(403)
      expect(error.message).toBe('Admin access required')
      expect(error.name).toBe('ForbiddenError')
    })
  })

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const result = await requireAuth()
      expect(result.user).toEqual(mockUser)
    })

    it('should throw UnauthorizedError when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      await expect(requireAuth()).rejects.toThrow(UnauthorizedError)
    })

    it('should throw UnauthorizedError on auth error', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      await expect(requireAuth()).rejects.toThrow(UnauthorizedError)
    })
  })

  describe('requireAdmin', () => {
    it('should return user and profile when user is admin', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@example.com' }
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      })

      const result = await requireAdmin()
      expect(result.user).toEqual(mockUser)
      expect(result.profile.role).toBe('admin')
    })

    it('should throw ForbiddenError when user is not admin', async () => {
      const mockUser = { id: 'user-456', email: 'user@example.com' }
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: { role: 'user' },
        error: null,
      })

      await expect(requireAdmin()).rejects.toThrow(ForbiddenError)
    })

    it('should log unauthorized admin access attempt', async () => {
      const mockUser = { id: 'user-789', email: 'user@example.com' }
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: { role: 'user' },
        error: null,
      })

      try {
        await requireAdmin()
      } catch {
        // expected
      }

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'unauthorized_access',
          user_id: 'user-789',
          event_data: { attempted_action: 'admin_access' },
        })
      )
    })

    it('should throw UnauthorizedError when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      await expect(requireAdmin()).rejects.toThrow(UnauthorizedError)
    })

    it('should throw ForbiddenError when profile query fails', async () => {
      const mockUser = { id: 'user-000', email: 'user@example.com' }
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      })

      await expect(requireAdmin()).rejects.toThrow(ForbiddenError)
    })
  })
})
