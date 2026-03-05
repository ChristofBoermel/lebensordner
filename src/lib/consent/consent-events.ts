export const HEALTH_CONSENT_GRANTED_EVENT = 'consent:health-granted'

export type HealthConsentGrantedDetail = {
  grantedAt: string
}

export function emitHealthConsentGranted() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<HealthConsentGrantedDetail>(HEALTH_CONSENT_GRANTED_EVENT, {
      detail: { grantedAt: new Date().toISOString() },
    })
  )
}
