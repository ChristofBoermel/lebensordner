import { validateRequiredEnvVars } from '@/lib/config/validate-env'
import { updateSession } from '@/lib/supabase/middleware'
import { NextRequest } from 'next/server'

let envValidated = false

export async function middleware(request: NextRequest) {
  if (!envValidated) {
    validateRequiredEnvVars()
    envValidated = true
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
