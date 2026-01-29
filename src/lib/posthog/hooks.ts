'use client'

import { useCallback } from 'react'
import { posthog } from '@/lib/posthog/client'

// Hook for tracking custom events
export const usePostHog = () => {
  const capture = useCallback((event: string, properties?: Record<string, any>) => {
    if (posthog.__loaded) {
      posthog.capture(event, properties)
    }
  }, [])

  const identify = useCallback((userId: string, properties?: Record<string, any>) => {
    if (posthog.__loaded) {
      posthog.identify(userId, properties)
    }
  }, [])

  const reset = useCallback(() => {
    if (posthog.__loaded) {
      posthog.reset()
    }
  }, [])

  const setPersonProperties = useCallback((properties: Record<string, any>) => {
    if (posthog.__loaded) {
      posthog.people.set(properties)
    }
  }, [])

  // Feature flags
  const isFeatureEnabled = useCallback((flagKey: string): boolean => {
    if (posthog.__loaded) {
      return posthog.isFeatureEnabled(flagKey) ?? false
    }
    return false
  }, [])

  const getFeatureFlag = useCallback((flagKey: string): string | boolean | undefined => {
    if (posthog.__loaded) {
      return posthog.getFeatureFlag(flagKey)
    }
    return undefined
  }, [])

  return {
    capture,
    identify,
    reset,
    setPersonProperties,
    isFeatureEnabled,
    getFeatureFlag,
    posthog,
  }
}

// Pre-defined event names for consistency
export const ANALYTICS_EVENTS = {
  // Auth events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  
  // Onboarding events
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  
  // Document events
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_DOWNLOADED: 'document_downloaded',
  DOCUMENT_DELETED: 'document_deleted',
  DOCUMENT_PREVIEWED: 'document_previewed',
  
  // Emergency info events
  EMERGENCY_CONTACT_ADDED: 'emergency_contact_added',
  MEDICAL_INFO_UPDATED: 'medical_info_updated',
  
  // Trusted person events
  TRUSTED_PERSON_ADDED: 'trusted_person_added',
  TRUSTED_PERSON_REMOVED: 'trusted_person_removed',
  
  // Reminder events
  REMINDER_CREATED: 'reminder_created',
  REMINDER_COMPLETED: 'reminder_completed',
  REMINDER_DELETED: 'reminder_deleted',
  
  // Export events
  PDF_EXPORTED: 'pdf_exported',
  PAGE_PRINTED: 'page_printed',
  
  // Subscription events
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  TRIAL_STARTED: 'trial_started',

  // Upgrade nudge events
  UPGRADE_NUDGE_SHOWN: 'upgrade_nudge_shown',
  UPGRADE_NUDGE_DISMISSED: 'upgrade_nudge_dismissed',
  UPGRADE_NUDGE_CLICKED: 'upgrade_nudge_clicked',
  UPGRADE_MODAL_SHOWN: 'upgrade_modal_shown',
  UPGRADE_MODAL_DISMISSED: 'upgrade_modal_dismissed',
  UPGRADE_MODAL_CLICKED: 'upgrade_modal_clicked',
  PRICING_PAGE_VIEWED: 'pricing_page_viewed',
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_COMPLETED: 'checkout_completed',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
} as const
