const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
  'CRON_SECRET',
  'TURNSTILE_SECRET_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
] as const

export function validateRequiredEnvVars(): void {
  const missing = requiredEnvVars.filter(
    (key) => !process.env[key]?.trim()
  )

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\nPlease check your .env.local file and ensure all required variables are set.`
    )
  }
}
