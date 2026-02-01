import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFamilyPermissions, canAccessUserDocuments, FamilyPermissions } from './family-permissions'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

describe('family-permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  describe('getFamilyPermissions', () => {
    it('should grant full access to owner viewing own documents', async () => {
      const result = await getFamilyPermissions('owner-123', 'owner-123')

      expect(result.isOwner).toBe(true)
      expect(result.canDownload).toBe(true)
      expect(result.canView).toBe(true)
    })

    it('should grant access to accepted trusted person', async () => {
      // Mock trusted_persons lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'tp-1', name: 'Test', access_level: 'immediate', relationship: 'child', user_id: 'owner-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Owner Name', email: 'owner@test.com' },
          error: null,
        })

      const result = await getFamilyPermissions('member-123', 'owner-123')

      expect(result.isOwner).toBe(false)
      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(true)
      expect(result.ownerName).toBe('Owner Name')
    })

    it('should deny access if no relationship exists', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }
      })

      const result = await getFamilyPermissions('stranger-123', 'owner-123')

      expect(result.canView).toBe(false)
      expect(result.canDownload).toBe(false)
      expect(result.isOwner).toBe(false)
    })
  })

  describe('canAccessUserDocuments', () => {
    it('should return hasAccess=true for accepted trusted person', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'tp-1', name: 'Test', access_level: 'immediate', relationship: 'child', user_id: 'owner-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Owner Name', email: 'owner@test.com' },
          error: null,
        })

      const result = await canAccessUserDocuments('viewer-123', 'owner-123')

      expect(result.hasAccess).toBe(true)
      expect(result.accessLevel).toBe('immediate')
      expect(result.ownerName).toBe('Owner Name')
    })

    it('should return hasAccess=false for non-trusted user', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }
      })

      const result = await canAccessUserDocuments('stranger-123', 'owner-123')

      expect(result.hasAccess).toBe(false)
    })
  })
})
