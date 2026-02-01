import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFamilyPermissions, getOwnerSubscriptionTier } from './family-permissions'
import { getTierFromSubscription } from '@/lib/subscription-tiers'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/subscription-tiers', () => ({
  getTierFromSubscription: vi.fn(),
}))

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}

describe('family-permissions logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  describe('getOwnerSubscriptionTier', () => {
    it('should return canDownload=true for premium tier', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { subscription_status: 'active', stripe_price_id: 'price_premium' },
        error: null,
      })
        ; (getTierFromSubscription as any).mockReturnValue({ id: 'premium' })

      const result = await getOwnerSubscriptionTier('owner-123')
      expect(result.canDownload).toBe(true)
      expect(result.status).toBe('active')
    })

    it('should return canDownload=false for basic tier', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { subscription_status: 'active', stripe_price_id: 'price_basic' },
        error: null,
      })
        ; (getTierFromSubscription as any).mockReturnValue({ id: 'basic' })

      const result = await getOwnerSubscriptionTier('owner-123')
      expect(result.canDownload).toBe(false)
    })

    it('should return canDownload=false if profile not found', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Not found') })

      const result = await getOwnerSubscriptionTier('missing-owner')
      expect(result.canDownload).toBe(false)
      expect(result.status).toBe(null)
    })
  })

  describe('getFamilyPermissions', () => {
    it('should grant full access to owner', async () => {
      // Mock profile check for owner
      mockSupabase.single.mockResolvedValue({
        data: { subscription_status: 'active' },
        error: null,
      })

      const permissions = await getFamilyPermissions('owner-123', 'owner-123')
      expect(permissions.isOwner).toBe(true)
      expect(permissions.canDownload).toBe(true)
      expect(permissions.canView).toBe(true)
    })

    it('should grant view-only access to basic family member', async () => {
      // 1. Mock relationship check
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { id: 'tp-1', role: 'family_member', access_level: 'immediate' },
        error: null,
      })
      // 2. Mock owner subscription check (now we need to handle sequential calls)
      // First call is getFamilyRelationship, second is getOwnerSubscriptionTier
      mockSupabase.single.mockResolvedValue({
        data: { subscription_status: 'active', stripe_price_id: 'price_basic' },
        error: null,
      })
        ; (getTierFromSubscription as any).mockReturnValue({ id: 'basic' })

      const permissions = await getFamilyPermissions('member-123', 'owner-123')
      expect(permissions.isOwner).toBe(false)
      expect(permissions.canView).toBe(true)
      expect(permissions.canDownload).toBe(false)
    })

    it('should grant download access to premium family member', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { id: 'tp-1', role: 'family_member', access_level: 'immediate' },
        error: null,
      })
      mockSupabase.single.mockResolvedValue({
        data: { subscription_status: 'active', stripe_price_id: 'price_premium' },
        error: null,
      })
        ; (getTierFromSubscription as any).mockReturnValue({ id: 'premium' })

      const permissions = await getFamilyPermissions('member-123', 'owner-123')
      expect(permissions.canDownload).toBe(true)
    })

    it('should deny access if no relationship exists', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null })

      const permissions = await getFamilyPermissions('stranger-123', 'owner-123')
      expect(permissions.canView).toBe(false)
      expect(permissions.canDownload).toBe(false)
    })
  })
})
