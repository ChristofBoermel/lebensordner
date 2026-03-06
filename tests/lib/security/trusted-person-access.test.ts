import { describe, expect, it } from 'vitest'
import {
  canTrustedPersonPerformAction,
  buildTrustedPersonAccessDeniedMessage,
} from '@/lib/security/trusted-person-access'

describe('trusted-person access policy', () => {
  it('allows immediate access for view and download', () => {
    expect(canTrustedPersonPerformAction('immediate', 'view')).toBe(true)
    expect(canTrustedPersonPerformAction('immediate', 'download')).toBe(true)
  })

  it('allows emergency only for view', () => {
    expect(canTrustedPersonPerformAction('emergency', 'view')).toBe(true)
    expect(canTrustedPersonPerformAction('emergency', 'download')).toBe(false)
  })

  it('denies after_confirmation by default', () => {
    expect(canTrustedPersonPerformAction('after_confirmation', 'view')).toBe(false)
    expect(canTrustedPersonPerformAction('after_confirmation', 'download')).toBe(false)
  })

  it('returns clear denial messages', () => {
    expect(buildTrustedPersonAccessDeniedMessage('after_confirmation', 'view')).toMatch(/bestätigung/i)
    expect(buildTrustedPersonAccessDeniedMessage('emergency', 'download')).toMatch(/nicht erlaubt/i)
  })
})
