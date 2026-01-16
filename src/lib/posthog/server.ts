import { PostHog } from 'posthog-node'

// Server-side PostHog client
let posthogServerClient: PostHog | null = null

export const getPostHogServer = (): PostHog | null => {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null
  }

  if (!posthogServerClient) {
    posthogServerClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
      flushAt: 1, // Send events immediately in serverless
      flushInterval: 0,
    })
  }

  return posthogServerClient
}

// Helper to track server-side events
export const trackServerEvent = async (
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) => {
  const client = getPostHogServer()
  if (!client) return

  client.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      environment: process.env.NODE_ENV,
    },
  })

  // Flush immediately for serverless
  await client.shutdown()
}

// Helper to identify users server-side
export const identifyServerUser = async (
  distinctId: string,
  properties: Record<string, any>
) => {
  const client = getPostHogServer()
  if (!client) return

  client.identify({
    distinctId,
    properties,
  })

  await client.shutdown()
}
