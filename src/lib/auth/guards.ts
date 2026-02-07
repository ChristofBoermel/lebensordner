import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logSecurityEvent, EVENT_UNAUTHORIZED_ACCESS } from '@/lib/security/audit-log'
import type { User } from '@supabase/supabase-js'

// --- Custom error classes ---

export class UnauthorizedError extends Error {
  statusCode = 401

  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  statusCode = 403

  constructor(message = 'Admin access required') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

// --- Guard functions ---

export async function requireAuth(): Promise<{ user: User }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError()
  }

  return { user }
}

export async function requireAdmin(): Promise<{ user: User; profile: { role: string } }> {
  const { user } = await requireAuth()

  const supabase = await createServerSupabaseClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile || profile.role !== 'admin') {
    logSecurityEvent({
      event_type: EVENT_UNAUTHORIZED_ACCESS,
      user_id: user.id,
      event_data: { attempted_action: 'admin_access' },
    })
    throw new ForbiddenError()
  }

  return { user, profile }
}
