import posthog from 'posthog-js'

export const initPostHog = () => {
  if (typeof window === 'undefined') return

  // Only initialize if we have a key and haven't already initialized
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    console.warn('PostHog key not configured')
    return
  }

  if (posthog.__loaded) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',

    // Privacy-friendly settings for German market
    persistence: 'localStorage',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,

    // Session recording (disable for privacy if needed)
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true, // Mask sensitive inputs
      maskTextSelector: '[data-mask]', // Custom masking
    },

    // IMPORTANT: Disable opt-out for localhost testing
    opt_out_capturing_by_default: false,

    // Respect Do Not Track - DISABLED for testing (enable in production)
    respect_dnt: false,

    // Enable debug mode in development
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        posthog.debug() // Shows PostHog logs in console
      }
      // Make PostHog available globally for debugging
      if (typeof window !== 'undefined') {
        (window as any).posthog = posthog
      }
    },
  })
}

export { posthog }
