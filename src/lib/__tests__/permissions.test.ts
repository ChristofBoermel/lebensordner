import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFamilyPermissions } from '../permissions/family-permissions'
import { createClient } from '@supabase/supabase-js'

// Minimal Supabase mock - keine Mock-Hölle
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

describe('Family Permissions | Rollen & Berechtigungen', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('getFamilyPermissions', () => {
    it('should grant access to linked family member', async () => {
      // Arrange: Family member linked via trusted_persons
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'tp-1', name: 'Test', access_level: 'immediate', relationship: 'child', user_id: 'owner-1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Owner Name', email: 'owner@test.com' },
          error: null,
        })

      // Act
      const result = await getFamilyPermissions('family-1', 'owner-1')

      // Assert
      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(true)
      expect(result.isOwner).toBe(false)
      expect(result.ownerName).toBe('Owner Name')
    })

    it('should grant full access to owner viewing own documents', async () => {
      // Act - owner checking own documents (no DB call needed)
      const result = await getFamilyPermissions('owner-1', 'owner-1')

      // Assert
      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(true)
      expect(result.isOwner).toBe(true)
    })

    it('should deny all access for non-family member', async () => {
      // Arrange: No relationship exists in trusted_persons
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      // Act
      const result = await getFamilyPermissions('stranger-123', 'owner-123')

      // Assert
      expect(result.canView).toBe(false)
      expect(result.canDownload).toBe(false)
      expect(result.isOwner).toBe(false)
    })
  })
})
