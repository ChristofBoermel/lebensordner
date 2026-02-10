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

// --- Constants ---

const IP_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 }
const EMAIL_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 }
const CAPTCHA_THRESHOLD = 3
const LOCKOUT_THRESHOLD = 5

// --- Turnstile Verification ---

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error('[AUTH] TURNSTILE_SECRET_KEY not configured')
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
    console.error('[AUTH] Turnstile verification failed:', error)
    return false
  }
}

// --- Login Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, turnstileToken, rememberMe } = body
    const persistSession = rememberMe ?? false

    if (!email || !password) {
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
      ...IP_RATE_LIMIT,
    })

    if (!ipRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (ipRateLimit.resetAt.getTime() - Date.now()) / 1000
      )
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfterSeconds },
        { status: 429 }
      )
    }

    // Check email-based rate limit
    const emailRateLimit = await checkRateLimit({
      identifier: `login_email:${email}`,
      endpoint: '/api/auth/login',
      ...EMAIL_RATE_LIMIT,
    })

    if (!emailRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (emailRateLimit.resetAt.getTime() - Date.now()) / 1000
      )
      return NextResponse.json(
        { error: 'Too many attempts for this email. Please try again later.', retryAfterSeconds },
        { status: 429 }
      )
    }

    // --- Account Lockout Check ---

    const locked = await isAccountLocked(email)
    if (locked) {
      await logSecurityEvent({
        event_type: 'login_failure',
        event_data: { email, reason: 'account_locked' },
        request,
      })
      return NextResponse.json(
        { error: 'Account locked. Reset password to unlock.' },
        { status: 403 }
      )
    }

    // --- Failure Count & CAPTCHA Check ---

    const failureCount = await getFailureCount(email)

    if (failureCount >= CAPTCHA_THRESHOLD && !turnstileToken) {
      await logSecurityEvent({
        event_type: 'captcha_required',
        event_data: { email, failureCount },
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
        await logSecurityEvent({
          event_type: 'captcha_failed',
          event_data: { email },
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
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      email,
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
          identifier: `login_email:${email}`,
          endpoint: '/api/auth/login',
          ...EMAIL_RATE_LIMIT,
        }),
      ])

      const newFailureCount = failureCount + 1

      await logSecurityEvent({
        event_type: 'login_failure',
        event_data: { email, failureCount: newFailureCount },
        request,
      })

      // Check if account should be locked
      if (newFailureCount >= LOCKOUT_THRESHOLD) {
        await lockAccount(email)
        await logSecurityEvent({
          event_type: 'account_locked',
          event_data: { email, failureCount: newFailureCount },
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
    const lockedAfterAuth = await isAccountLocked(email)
    if (lockedAfterAuth) {
      await supabase.auth.signOut()
      await logSecurityEvent({
        event_type: 'login_blocked_locked_account',
        event_data: { email, reason: 'account_locked_after_authentication' },
        request,
      })
      return NextResponse.json(
        { error: 'Account locked during login. Reset password to unlock.' },
        { status: 403 }
      )
    }

    // Reset failure count on successful login
    await resetFailureCount(email)

    await logSecurityEvent({
      event_type: 'login_success',
      user_id: data.user?.id,
      event_data: { email, rememberMe: persistSession },
      request,
    })

    // Check for new device and send notification
    if (data.user?.id) {
      const userAgent = request.headers.get('user-agent') || 'Unknown'
      try {
        const newDevice = await isNewDevice(data.user.id, userAgent, clientIp)
        if (newDevice) {
          // Fire and forget - don't block login response
          sendSecurityNotification('new_login', email, {
            userName: email,
            timestamp: new Date().toISOString(),
            ipAddress: clientIp,
            userAgent,
          }).catch((err) => console.error('New device notification failed:', err))
        }
      } catch (err) {
        console.error('Device detection failed:', err)
      }
    }

    return NextResponse.json({
      success: true,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    })
  } catch (error) {
    console.error('[AUTH] Login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
