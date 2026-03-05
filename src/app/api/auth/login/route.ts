import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { checkRateLimit, incrementRateLimit } from '@/lib/security/rate-limit'
import { logSecurityEvent } from '@/lib/security/audit-log'
import {
  isAccountLocked,
  lockAccount,
  getFailureCount,
  resetFailureCount,
} from '@/lib/security/auth-lockout'
import { isNewDevice } from '@/lib/security/device-detection'
import { sendSecurityNotification } from '@/lib/email/security-notifications'
import { emitStructuredError, emitStructuredWarn, emitStructuredInfo } from '@/lib/errors/structured-logger'
import { createPendingAuthChallenge } from '@/lib/security/pending-auth'

// --- Constants ---

const IP_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 }
const EMAIL_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 }
const CAPTCHA_THRESHOLD = 3
const LOCKOUT_THRESHOLD = 5

// --- Turnstile Verification ---

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    emitStructuredError({
      error_type: 'config',
      error_message: 'TURNSTILE_SECRET_KEY not configured',
      endpoint: '/api/auth/login',
    })
    return false
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: ip,
        }),
      }
    )

    const data = await response.json()
    return data.success === true
  } catch (error) {
    emitStructuredError({
      error_type: 'auth',
      error_message: `Turnstile verification failed: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/auth/login',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return false
  }
}

// --- Login Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, turnstileToken, rememberMe } = body
    const persistSession = rememberMe ?? false
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Extract client IP
    const forwarded = request.headers.get('x-forwarded-for') || ''
    const clientIp = forwarded.split(',')[0]?.trim() || '127.0.0.1'

    // --- Rate Limiting ---

    // Check IP-based rate limit
    const ipRateLimit = await checkRateLimit({
      identifier: `login_ip:${clientIp}`,
      endpoint: '/api/auth/login',
      failMode: 'closed',
      ...IP_RATE_LIMIT,
    })

    if (ipRateLimit.available === false) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: 'Login temporarily rejected because rate limiter is unavailable',
        endpoint: '/api/auth/login',
        metadata: { clientIp, scope: 'ip' },
      })
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }

    if (!ipRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (ipRateLimit.resetAt.getTime() - Date.now()) / 1000
      )
      emitStructuredWarn({
        event_type: 'security',
        event_message: 'Login blocked by IP rate limit',
        endpoint: '/api/auth/login',
        metadata: { clientIp, retryAfterSeconds },
      })
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfterSeconds },
        { status: 429 }
      )
    }

    // Check email-based rate limit
    const emailRateLimit = await checkRateLimit({
      identifier: `login_email:${normalizedEmail}`,
      endpoint: '/api/auth/login',
      failMode: 'closed',
      ...EMAIL_RATE_LIMIT,
    })

    if (emailRateLimit.available === false) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: 'Login temporarily rejected because rate limiter is unavailable',
        endpoint: '/api/auth/login',
        metadata: { clientIp, scope: 'email' },
      })
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }

    if (!emailRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (emailRateLimit.resetAt.getTime() - Date.now()) / 1000
      )
      emitStructuredWarn({
        event_type: 'security',
        event_message: 'Login blocked by email rate limit',
        endpoint: '/api/auth/login',
        metadata: { retryAfterSeconds },
      })
      return NextResponse.json(
        { error: 'Too many attempts for this email. Please try again later.', retryAfterSeconds },
        { status: 429 }
      )
    }

    // --- Account Lockout Check ---

    const locked = await isAccountLocked(normalizedEmail)
    if (locked) {
      emitStructuredWarn({
        event_type: 'security',
        event_message: 'Login blocked for locked account',
        endpoint: '/api/auth/login',
        metadata: { clientIp },
      })
      await logSecurityEvent({
        event_type: 'login_failure',
        event_data: { email: normalizedEmail, reason: 'account_locked' },
        request,
      })
      return NextResponse.json(
        { error: 'Account locked. Reset password to unlock.' },
        { status: 403 }
      )
    }

    // --- Failure Count & CAPTCHA Check ---

    const failureCount = await getFailureCount(normalizedEmail)

    if (failureCount >= CAPTCHA_THRESHOLD && !turnstileToken) {
      emitStructuredInfo({
        event_type: 'security',
        event_message: 'CAPTCHA required for login attempt',
        endpoint: '/api/auth/login',
        metadata: { clientIp, failureCount },
      })
      await logSecurityEvent({
        event_type: 'captcha_required',
        event_data: { email: normalizedEmail, failureCount },
        request,
      })
      return NextResponse.json(
        { error: 'CAPTCHA required', requiresCaptcha: true, failureCount },
        { status: 400 }
      )
    }

    // --- CAPTCHA Verification ---

    if (turnstileToken) {
      const captchaValid = await verifyTurnstile(turnstileToken, clientIp)
      if (!captchaValid) {
        emitStructuredWarn({
          event_type: 'security',
          event_message: 'Login CAPTCHA validation failed',
          endpoint: '/api/auth/login',
          metadata: { clientIp },
        })
        await logSecurityEvent({
          event_type: 'captcha_failed',
          event_data: { email: normalizedEmail },
          request,
        })
        return NextResponse.json(
          { error: 'Invalid CAPTCHA. Please try again.' },
          { status: 400 }
        )
      }
    }

    // --- Authentication Attempt ---

    const cookieStore = await cookies()
    const extraCookieOptions = persistSession
      ? { maxAge: 30 * 24 * 60 * 60 } // 30 days in seconds
      : {} // Session cookie (no maxAge — expires when browser closes)

    const supabase = createServerClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_ANON_KEY']!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options, ...extraCookieOptions })
            } catch {
              // Handle cookie setting in server components
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch {
              // Handle cookie removal in server components
            }
          },
        },
      }
    )
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      // Increment failure counters
      await Promise.all([
        incrementRateLimit({
          identifier: `login_ip:${clientIp}`,
          endpoint: '/api/auth/login',
          ...IP_RATE_LIMIT,
        }),
        incrementRateLimit({
          identifier: `login_email:${normalizedEmail}`,
          endpoint: '/api/auth/login',
          ...EMAIL_RATE_LIMIT,
        }),
      ])

      const newFailureCount = failureCount + 1
      emitStructuredWarn({
        event_type: 'security',
        event_message: 'Login failed: invalid credentials',
        endpoint: '/api/auth/login',
        metadata: { clientIp, failureCount: newFailureCount },
      })

      await logSecurityEvent({
        event_type: 'login_failure',
        event_data: { email: normalizedEmail, failureCount: newFailureCount },
        request,
      })

      // Check if account should be locked
      if (newFailureCount >= LOCKOUT_THRESHOLD) {
        emitStructuredWarn({
          event_type: 'security',
          event_message: 'Account locked due to repeated login failures',
          endpoint: '/api/auth/login',
          metadata: { clientIp, failureCount: newFailureCount },
        })
        await lockAccount(normalizedEmail)
        await logSecurityEvent({
          event_type: 'account_locked',
          event_data: { email: normalizedEmail, failureCount: newFailureCount },
          request,
        })
        return NextResponse.json(
          { error: 'Account locked after 5 failed attempts. Reset password to unlock.' },
          { status: 403 }
        )
      }

      // Return appropriate error with remaining attempts info
      const requiresCaptcha = newFailureCount >= CAPTCHA_THRESHOLD
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          failureCount: newFailureCount,
          ...(requiresCaptcha ? { requiresCaptcha: true } : {}),
        },
        { status: 401 }
      )
    }

    // --- Success ---

    // Post-authentication lockout check (TOCTOU race condition defense)
    const lockedAfterAuth = await isAccountLocked(normalizedEmail)
    if (lockedAfterAuth) {
      await supabase.auth.signOut()
      await logSecurityEvent({
        event_type: 'login_blocked_locked_account',
        event_data: { email: normalizedEmail, reason: 'account_locked_after_authentication' },
        request,
      })
      return NextResponse.json(
        { error: 'Account locked during login. Reset password to unlock.' },
        { status: 403 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('two_factor_enabled')
      .eq('id', data.user?.id)
      .maybeSingle()

    if (profile?.two_factor_enabled) {
      const accessToken = data.session?.access_token
      const refreshToken = data.session?.refresh_token

      if (!accessToken || !refreshToken || !data.user?.id) {
        emitStructuredError({
          error_type: 'auth',
          error_message: 'Login created a 2FA pending state without a valid session payload',
          endpoint: '/api/auth/login',
        })
        return NextResponse.json(
          { error: 'An unexpected error occurred' },
          { status: 500 }
        )
      }

      try {
        const challenge = await createPendingAuthChallenge({
          userId: data.user.id,
          email: normalizedEmail,
          accessToken,
          refreshToken,
          rememberMe: persistSession,
          clientIp,
          userAgent: request.headers.get('user-agent') || 'Unknown',
        })

        await resetFailureCount(normalizedEmail)
        await supabase.auth.signOut()

        await logSecurityEvent({
          event_type: 'login_success_pending_2fa',
          user_id: data.user.id,
          event_data: { email: normalizedEmail, rememberMe: persistSession },
          request,
        })

        return NextResponse.json({
          success: true,
          requiresTwoFactor: true,
          challengeId: challenge.challengeId,
          expiresInSeconds: challenge.expiresInSeconds,
        })
      } catch (error) {
        emitStructuredError({
          error_type: 'auth',
          error_message: `Failed to issue 2FA challenge: ${error instanceof Error ? error.message : String(error)}`,
          endpoint: '/api/auth/login',
          stack: error instanceof Error ? error.stack : undefined,
        })
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        )
      }
    }

    // Reset failure count on successful login
    await resetFailureCount(normalizedEmail)

    await logSecurityEvent({
      event_type: 'login_success',
      user_id: data.user?.id,
      event_data: { email: normalizedEmail, rememberMe: persistSession },
      request,
    })

    // Check for new device and send notification
    if (data.user?.id) {
      const userAgent = request.headers.get('user-agent') || 'Unknown'
      try {
        const newDevice = await isNewDevice(data.user.id, userAgent, clientIp)
        if (newDevice) {
          // Fire and forget - don't block login response
          sendSecurityNotification('new_login', normalizedEmail, {
            userName: normalizedEmail,
            timestamp: new Date().toISOString(),
            ipAddress: clientIp,
            userAgent,
          }).catch((err) =>
            emitStructuredError({
              error_type: 'notification',
              error_message: `New device notification failed: ${err instanceof Error ? err.message : String(err)}`,
              endpoint: '/api/auth/login',
              stack: err instanceof Error ? err.stack : undefined,
            })
          )
        }
      } catch (err) {
        emitStructuredError({
          error_type: 'auth',
          error_message: `Device detection failed: ${err instanceof Error ? err.message : String(err)}`,
          endpoint: '/api/auth/login',
          stack: err instanceof Error ? err.stack : undefined,
        })
      }
    }

    return NextResponse.json({
      success: true,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    })
  } catch (error) {
    emitStructuredError({
      error_type: 'auth',
      error_message: `Login error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: '/api/auth/login',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
