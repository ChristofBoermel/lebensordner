import { createClient } from '@supabase/supabase-js'
import { emitStructuredError } from '@/lib/errors/structured-logger'

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env['SUPABASE_URL']!,
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

    const { data, error } = await supabase
      .from('security_audit_log')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', 'login_success')
      .eq('user_agent', userAgent)
      .gte('timestamp', thirtyDaysAgo)
      .limit(1)

    if (error) {
      emitStructuredError({
        error_type: 'auth',
        error_message: `Device detection query error: ${error.message}`,
        endpoint: 'lib/security/device-detection',
      })
      return false
    }

    return !data || data.length === 0
  } catch (error) {
    emitStructuredError({
      error_type: 'auth',
      error_message: `Device detection error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: 'lib/security/device-detection',
      stack: error instanceof Error ? error.stack : undefined,
    })
    // Default to not new device to avoid spamming notifications
    return false
  }
}
