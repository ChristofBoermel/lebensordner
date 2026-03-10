const requiredKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

export function hasRequiredE2EEnv() {
  return requiredKeys.every((key) => Boolean(process.env[key]))
}

export function requireE2EEnv(key: (typeof requiredKeys)[number] | 'PLAYWRIGHT_BASE_URL' | 'E2E_BASE_URL') {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function getBaseUrl() {
  return (
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.E2E_BASE_URL ??
    'http://127.0.0.1:3000'
  )
}
