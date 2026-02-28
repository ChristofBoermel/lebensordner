import { createClient } from '@supabase/supabase-js'
import { sendSecurityNotification } from '@/lib/email/security-notifications'

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// --- Account Lockout Functions ---

export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('auth_lockouts')
      .select('id')
      .eq('email', email)
      .is('unlocked_at', null)
      .limit(1)
      .single()

    if (error || !data) return false
    return true
  } catch {
    return false
  }
}

export async function lockAccount(email: string, reason?: string): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .from('auth_lockouts')
      .insert({
        email,
        locked_at: new Date().toISOString(),
        reason: reason || 'Too many failed login attempts',
      })

    // Send lockout notification email (fire and forget)
    sendSecurityNotification('account_locked', email, {
      userName: email,
      timestamp: new Date().toISOString(),
    }).catch((err) => console.error('Lockout notification failed:', err))
  } catch (error) {
    console.error('Failed to lock account:', error)
  }
}

export async function unlockAccount(email: string): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .from('auth_lockouts')
      .update({ unlocked_at: new Date().toISOString() })
      .eq('email', email)
      .is('unlocked_at', null)
  } catch (error) {
    console.error('Failed to unlock account:', error)
  }
}

export async function getFailureCount(email: string): Promise<number> {
  try {
    const supabase = createServiceClient()
    const windowStart = new Date(Date.now() - 15 * 60 * 1000) // 15 minute window

    const { data, error } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('identifier', `login_email:${email}`)
      .eq('endpoint', '/api/auth/login')
      .gte('window_start', windowStart.toISOString())
      .order('window_start', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return 0
    return data.request_count
  } catch {
    return 0
  }
}

export async function resetFailureCount(email: string): Promise<void> {
  try {
    const locked = await isAccountLocked(email)
    if (locked) {
      console.log(`Skipping failure count reset for locked account: ${email}`)
      return
    }

    const supabase = createServiceClient()
    await supabase
      .from('rate_limits')
      .delete()
      .eq('identifier', `login_email:${email}`)
      .eq('endpoint', '/api/auth/login')
  } catch (error) {
    console.error('Failed to reset failure count:', error)
  }
}
