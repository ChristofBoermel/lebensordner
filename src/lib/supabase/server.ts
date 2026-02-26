import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { validateEncryptionKey } from '@/lib/security/encryption'

// Validate ENCRYPTION_KEY on first request, not at module load (breaks Docker build).
// The keyValidated cache in encryption.ts means subsequent calls are no-ops.
let encryptionValidated = false

export async function createServerSupabaseClient() {
  if (!encryptionValidated) {
    validateEncryptionKey()
    encryptionValidated = true
  }
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie setting in server components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie removal in server components
          }
        },
      },
    }
  )
}
