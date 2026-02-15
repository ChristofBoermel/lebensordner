import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSENT_VERSION } from '@/lib/consent/constants'
import {
  getConsentHistory,
  getCurrentConsent,
  grantHealthDataConsent,
  hasHealthDataConsent,
  recordConsent,
  withdrawHealthDataConsent,
} from '@/lib/consent/manager'
import { createMockConsentRecord, createMockProfile } from '../../fixtures/consent'

const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()

const createMockSupabaseClient = () => ({
  from: vi.fn((table: string) => {
    if (table === 'consent_ledger') {
      return {
        insert: mockInsert,
        select: mockSelect,
      }
    }
    if (table === 'profiles') {
      return {
        select: mockSelect,
        update: mockUpdate,
      }
    }
    return {
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    }
  }),
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}))

describe('consent manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recordConsent', () => {
    it('should insert consent ledger record with correct parameters', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })

      await recordConsent('user_1', 'analytics', true, '1.0')

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user_1',
        consent_type: 'analytics',
        granted: true,
        version: '1.0',
      })
    })
  })

  describe('getConsentHistory', () => {
    it('should return consent records ordered by timestamp', async () => {
      const records = [
        createMockConsentRecord({ id: 'consent_1', timestamp: '2025-01-02T00:00:00.000Z' }),
        createMockConsentRecord({ id: 'consent_2', timestamp: '2025-01-01T00:00:00.000Z' }),
      ]

      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          order: mockOrder.mockResolvedValueOnce({
            data: records,
            error: null,
          }),
        }),
      })

      const result = await getConsentHistory('user_1')

      expect(mockOrder).toHaveBeenCalledWith('timestamp', { ascending: false })
      expect(result).toEqual(records)
    })
  })

  describe('getCurrentConsent', () => {
    it('should return latest consent for specific type', async () => {
      const record = createMockConsentRecord({
        consent_type: 'privacy_policy',
        timestamp: '2025-01-05T00:00:00.000Z',
      })

      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          eq: mockEq.mockReturnValueOnce({
            order: mockOrder.mockReturnValueOnce({
              limit: mockLimit.mockReturnValueOnce({
                single: mockSingle.mockResolvedValueOnce({
                  data: record,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const result = await getCurrentConsent('user_1', 'privacy_policy')

      expect(mockOrder).toHaveBeenCalledWith('timestamp', { ascending: false })
      expect(result).toEqual(record)
    })
  })

  describe('hasHealthDataConsent', () => {
    it('should return true when health_data_consent_granted is true', async () => {
      const profile = createMockProfile({ health_data_consent_granted: true })
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          single: mockSingle.mockResolvedValueOnce({ data: profile, error: null }),
        }),
      })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(true)
    })

    it('should return false when health_data_consent_granted is false', async () => {
      const profile = createMockProfile({ health_data_consent_granted: false })
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          single: mockSingle.mockResolvedValueOnce({ data: profile, error: null }),
        }),
      })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(false)
    })

    it('should return false when profile not found', async () => {
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          single: mockSingle.mockResolvedValueOnce({ data: null, error: null }),
        }),
      })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(false)
    })

    it('should return false on database error', async () => {
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          single: mockSingle.mockResolvedValueOnce({ data: null, error: new Error('db') }),
        }),
      })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(false)
    })
  })

  describe('grantHealthDataConsent', () => {
    it('should insert consent ledger record with granted=true', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })
      mockUpdate.mockReturnValueOnce({
        eq: mockEq.mockResolvedValueOnce({ error: null }),
      })

      await grantHealthDataConsent('user_1')

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user_1',
        consent_type: 'health_data',
        granted: true,
        version: CONSENT_VERSION,
      })
    })

    it('should update profiles.health_data_consent_granted to true', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })
      mockUpdate.mockReturnValueOnce({
        eq: mockEq.mockResolvedValueOnce({ error: null }),
      })

      await grantHealthDataConsent('user_1')

      expect(mockUpdate).toHaveBeenCalledWith({
        health_data_consent_granted: true,
        health_data_consent_timestamp: expect.any(String),
      })
    })

    it('should set health_data_consent_timestamp', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })
      mockUpdate.mockReturnValueOnce({
        eq: mockEq.mockResolvedValueOnce({ error: null }),
      })

      await grantHealthDataConsent('user_1')

      const updatePayload = mockUpdate.mock.calls[0]?.[0]
      expect(updatePayload?.health_data_consent_timestamp).toEqual(expect.any(String))
    })

    it('should return {ok: true} on success', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })
      mockUpdate.mockReturnValueOnce({
        eq: mockEq.mockResolvedValueOnce({ error: null }),
      })

      const result = await grantHealthDataConsent('user_1')

      expect(result).toEqual({ ok: true })
    })

    it('should return {ok: false, error} on ledger insert failure', async () => {
      mockInsert.mockResolvedValueOnce({ error: new Error('ledger') })

      const result = await grantHealthDataConsent('user_1')

      expect(result).toEqual({ ok: false, error: 'Failed to record health data consent' })
    })

    it('should return {ok: false, error} on profile update failure', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })
      mockUpdate.mockReturnValueOnce({
        eq: mockEq.mockResolvedValueOnce({ error: new Error('profile') }),
      })

      const result = await grantHealthDataConsent('user_1')

      expect(result).toEqual({ ok: false, error: 'Failed to update health data consent profile' })
    })
  })

  describe('withdrawHealthDataConsent', () => {
    it('should insert consent ledger record with granted=false', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })

      await withdrawHealthDataConsent('user_1')

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user_1',
        consent_type: 'health_data',
        granted: false,
        version: CONSENT_VERSION,
      })
    })

    it('should use CONSENT_VERSION from constants', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })

      await withdrawHealthDataConsent('user_1')

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ version: CONSENT_VERSION })
      )
    })

    it('should return {ok: true} on success', async () => {
      mockInsert.mockResolvedValueOnce({ error: null })

      const result = await withdrawHealthDataConsent('user_1')

      expect(result).toEqual({ ok: true })
    })

    it('should return {ok: false, error} on failure', async () => {
      mockInsert.mockResolvedValueOnce({ error: new Error('fail') })

      const result = await withdrawHealthDataConsent('user_1')

      expect(result).toEqual({ ok: false, error: 'Failed to record health data withdrawal' })
    })
  })
})
