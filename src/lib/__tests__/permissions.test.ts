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

  describe('getFamilyPermissions(ownerTier)', () => {
    it('should return canDownload=false for Basic Owner', async () => {
      // Arrange: Family member linked to basic owner
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { user_id: 'owner-basic', role: 'family_member' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { subscription_status: 'basic' },
          error: null,
        })

      // Act
      const result = await getFamilyPermissions('family-1', 'owner-basic')

      // Assert
      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(false)
      expect(result.isOwner).toBe(false)
      expect(result.ownerSubscription).toBe('basic')
    })

    it('should return canDownload=true for Premium Owner', async () => {
      // Arrange: Family member linked to premium owner
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { user_id: 'owner-premium', role: 'family_member' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { subscription_status: 'premium' },
          error: null,
        })

      // Act
      const result = await getFamilyPermissions('family-1', 'owner-premium')

      // Assert
      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(true)
      expect(result.isOwner).toBe(false)
      expect(result.ownerSubscription).toBe('premium')
    })

    it('should deny all access for non-family member', async () => {
      // Arrange: No relationship exists
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

    it('should allow full access for owner checking own documents', async () => {
      // Arrange: User is the owner
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      // Act
      const result = await getFamilyPermissions('owner-123', 'owner-123')

      // Assert
      expect(result.isOwner).toBe(true)
      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(true)
    })

    it('should deny access for emergency_contact role (not family_member)', async () => {
      // Arrange: Linked as emergency_contact, not family_member
      mockSupabase.single.mockResolvedValueOnce({
        data: { user_id: 'owner-123', role: 'emergency_contact' },
        error: null,
      })

      // Act
      const result = await getFamilyPermissions('emergency-1', 'owner-123')

      // Assert
      expect(result.canView).toBe(false)
      expect(result.canDownload).toBe(false)
    })
  })
})
