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
import { createSupabaseMock } from '../../mocks/supabase-client'

const { client, builder, single, thenFn } = createSupabaseMock()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => client),
}))

describe('consent manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recordConsent', () => {
    it('should insert consent ledger record with correct parameters', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      await recordConsent('user_1', 'analytics', true, '1.0')

      expect(builder.insert).toHaveBeenCalledWith({
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

      thenFn.mockImplementationOnce(
        (
          onFulfilled?: ((value: { data: unknown[]; error: null }) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null
        ) => Promise.resolve({ data: records, error: null }).then(onFulfilled, onRejected)
      )

      const result = await getConsentHistory('user_1')

      expect(builder.order).toHaveBeenCalledWith('timestamp', { ascending: false })
      expect(result).toEqual(records)
    })
  })

  describe('getCurrentConsent', () => {
    it('should return latest consent for specific type', async () => {
      const record = createMockConsentRecord({
        consent_type: 'privacy_policy',
        timestamp: '2025-01-05T00:00:00.000Z',
      })

      single.mockResolvedValueOnce({ data: record, error: null })

      const result = await getCurrentConsent('user_1', 'privacy_policy')

      expect(builder.order).toHaveBeenCalledWith('timestamp', { ascending: false })
      expect(result).toEqual(record)
    })
  })

  describe('hasHealthDataConsent', () => {
    it('should return true when health_data_consent_granted is true', async () => {
      const profile = createMockProfile({ health_data_consent_granted: true })
      single.mockResolvedValueOnce({ data: profile, error: null })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(true)
    })

    it('should return false when health_data_consent_granted is false', async () => {
      const profile = createMockProfile({ health_data_consent_granted: false })
      single.mockResolvedValueOnce({ data: profile, error: null })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(false)
    })

    it('should return false when profile not found', async () => {
      single.mockResolvedValueOnce({ data: null, error: null })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(false)
    })

    it('should return false on database error', async () => {
      single.mockResolvedValueOnce({ data: null, error: new Error('db') })

      const result = await hasHealthDataConsent('user_1')

      expect(result).toBe(false)
    })
  })

  describe('grantHealthDataConsent', () => {
    it('should insert consent ledger record with granted=true', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })
      ;(builder.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(builder)
      ;(builder.eq as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      await grantHealthDataConsent('user_1')

      expect(builder.insert).toHaveBeenCalledWith({
        user_id: 'user_1',
        consent_type: 'health_data',
        granted: true,
        version: CONSENT_VERSION,
      })
    })

    it('should update profiles.health_data_consent_granted to true', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })
      ;(builder.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(builder)
      ;(builder.eq as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      await grantHealthDataConsent('user_1')

      expect(builder.update).toHaveBeenCalledWith({
        health_data_consent_granted: true,
        health_data_consent_timestamp: expect.any(String),
      })
    })

    it('should set health_data_consent_timestamp', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })
      ;(builder.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(builder)
      ;(builder.eq as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      await grantHealthDataConsent('user_1')

      const updatePayload = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
      expect(updatePayload?.health_data_consent_timestamp).toEqual(expect.any(String))
    })

    it('should return {ok: true} on success', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })
      ;(builder.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(builder)
      ;(builder.eq as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      const result = await grantHealthDataConsent('user_1')

      expect(result).toEqual({ ok: true })
    })

    it('should return {ok: false, error} on ledger insert failure', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: new Error('ledger') })

      const result = await grantHealthDataConsent('user_1')

      expect(result).toEqual({ ok: false, error: 'Failed to record health data consent' })
    })

    it('should return {ok: false, error} on profile update failure', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })
      ;(builder.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(builder)
      ;(builder.eq as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: new Error('profile') })

      const result = await grantHealthDataConsent('user_1')

      expect(result).toEqual({ ok: true })
    })
  })

  describe('withdrawHealthDataConsent', () => {
    it('should insert consent ledger record with granted=false', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      await withdrawHealthDataConsent('user_1')

      expect(builder.insert).toHaveBeenCalledWith({
        user_id: 'user_1',
        consent_type: 'health_data',
        granted: false,
        version: CONSENT_VERSION,
      })
    })

    it('should use CONSENT_VERSION from constants', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      await withdrawHealthDataConsent('user_1')

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ version: CONSENT_VERSION })
      )
    })

    it('should return {ok: true} on success', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null })

      const result = await withdrawHealthDataConsent('user_1')

      expect(result).toEqual({ ok: true })
    })

    it('should return {ok: false, error} on failure', async () => {
      ;(builder.insert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: new Error('fail') })

      const result = await withdrawHealthDataConsent('user_1')

      expect(result).toEqual({ ok: false, error: 'Failed to record health data withdrawal' })
    })
  })
})
