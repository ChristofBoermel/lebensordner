import { createClient } from '@supabase/supabase-js'

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// --- Device Detection ---

/**
 * Checks if a user agent has been seen in recent login events for this user.
 * Returns true if this appears to be a new device (no matching user agent
 * in the last 30 days of successful logins).
 */
export async function isNewDevice(
  userId: string,
  userAgent: string,
  ipAddress: string
): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Look for a recent login_success event with the same user agent
    const { data, error } = await supabase
      .from('security_audit_log')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', 'login_success')
      .eq('user_agent', userAgent)
      .gte('timestamp', thirtyDaysAgo)
      .limit(1)

    if (error) {
      console.error('Device detection query error:', error)
      return false
    }

    // If no matching login found with this user agent, it's a new device
    return !data || data.length === 0
  } catch (error) {
    console.error('Device detection error:', error)
    // Default to not new device to avoid spamming notifications
    return false
  }
}
