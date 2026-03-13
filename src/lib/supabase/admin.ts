import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function sanitizeEnv(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, '')
  return normalized ? normalized : null
}

export function createServiceRoleSupabaseClient(): SupabaseClient {
  const url = sanitizeEnv(process.env['SUPABASE_URL'] || process.env['NEXT_PUBLIC_SUPABASE_URL'])
  const serviceRoleKey = sanitizeEnv(process.env['SUPABASE_SERVICE_ROLE_KEY'])

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service-role environment variables are missing')
  }

  return createClient(url, serviceRoleKey)
}
