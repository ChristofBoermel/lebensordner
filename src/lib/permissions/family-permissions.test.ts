import { expect, describe, it, vi, beforeEach } from 'vitest'
import {
  getFamilyPermissions,
  isOwner,
  getOwnerSubscriptionTier,
} from '@/lib/permissions/family-permissions'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

describe('Family Permissions', () => {
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
    it('should allow view but not download for family member with basic owner', async () => {
      // Setup: Family member linked to basic owner
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { user_id: 'owner-123', role: 'family_member' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { subscription_status: 'basic' },
          error: null,
        })

      const result = await getFamilyPermissions('family-123', 'owner-123')

      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(false)
      expect(result.isOwner).toBe(false)
      expect(result.ownerSubscription).toBe('basic')
    })

    it('should allow download for family member with premium owner', async () => {
      // Setup: Family member linked to premium owner
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { user_id: 'owner-123', role: 'family_member' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { subscription_status: 'premium' },
          error: null,
        })

      const result = await getFamilyPermissions('family-123', 'owner-123')

      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(true)
      expect(result.isOwner).toBe(false)
      expect(result.ownerSubscription).toBe('premium')
    })

    it('should deny access for non-family member', async () => {
      // Setup: No trusted_person relationship
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      const result = await getFamilyPermissions('stranger-123', 'owner-123')

      expect(result.canView).toBe(false)
      expect(result.canDownload).toBe(false)
      expect(result.isOwner).toBe(false)
    })

    it('should identify owner correctly', async () => {
      // Setup: User checking their own documents
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      const result = await getFamilyPermissions('owner-123', 'owner-123')

      expect(result.isOwner).toBe(true)
      expect(result.canView).toBe(true)
      expect(result.canDownload).toBe(true)
    })
  })

  describe('isOwner', () => {
    it('should return true for owner', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-123' },
        error: null,
      })

      const result = await isOwner('user-123')
      expect(result).toBe(true)
    })

    it('should return false for non-owner', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      const result = await isOwner('user-123')
      expect(result).toBe(false)
    })
  })

  describe('getOwnerSubscriptionTier', () => {
    it('should return tier from subscription status', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { subscription_status: 'premium' },
        error: null,
      })

      const result = await getOwnerSubscriptionTier('owner-123')
      expect(result).toBe('premium')
    })

    it('should return basic as default', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { subscription_status: null },
        error: null,
      })

      const result = await getOwnerSubscriptionTier('owner-123')
      expect(result).toBe('basic')
    })
  })
})
