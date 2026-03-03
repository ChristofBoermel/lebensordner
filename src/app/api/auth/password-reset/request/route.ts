import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  incrementRateLimit,
  RATE_LIMIT_PASSWORD_RESET,
} from "@/lib/security/rate-limit";
import {
  logSecurityEvent,
  EVENT_PASSWORD_RESET_REQUESTED,
} from "@/lib/security/audit-log";
import { emitStructuredError, emitStructuredInfo, emitStructuredWarn } from "@/lib/errors/structured-logger";

// --- Constants ---

const CAPTCHA_THRESHOLD = 2;

const normalizeOrigin = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const normalizeUrlWithPath = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    return normalizedPath && normalizedPath !== "/"
      ? `${parsed.origin}${normalizedPath}`
      : parsed.origin;
  } catch {
    return null;
  }
};

const resolvePublicOrigin = (request: NextRequest): string | null => {
  const fromEnv =
    normalizeOrigin(process.env.AUTH_PUBLIC_BASE_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.SITE_URL);

  if (fromEnv) return fromEnv;

  return normalizeOrigin(request.headers.get("origin"));
};

const resolvePublicSupabaseUrl = (): string | null => {
  return (
    normalizeUrlWithPath(process.env.NEXT_PUBLIC_SUPABASE_URL) ??
    normalizeUrlWithPath(process.env.API_EXTERNAL_URL) ??
    normalizeUrlWithPath(process.env.SUPABASE_URL)
  );
};

// --- Turnstile Verification ---

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    emitStructuredError({
      error_type: "config",
      error_message: "TURNSTILE_SECRET_KEY not configured",
      endpoint: "/api/auth/password-reset/request",
    });
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: ip,
        }),
      },
    );

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    emitStructuredError({
      error_type: "auth",
      error_message: `Turnstile verification failed: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: "/api/auth/password-reset/request",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

// --- User ID Resolution ---

async function resolveUserId(email: string): Promise<string | undefined> {
  try {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return undefined;

    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      },
    );

    if (!response.ok) return undefined;

    const data = await response.json();
    const users = data.users || [];
    const matchedUser = users.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    return matchedUser?.id;
  } catch {
    return undefined;
  }
}

// --- Password Reset Request Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, turnstileToken } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const forwarded = request.headers.get("x-forwarded-for") || "";
    const clientIp = forwarded.split(",")[0]?.trim() || "127.0.0.1";

    // --- Rate Limiting ---

    const ipRateLimit = await checkRateLimit({
      identifier: `password_reset_ip:${clientIp}`,
      endpoint: "/api/auth/password-reset/request",
      ...RATE_LIMIT_PASSWORD_RESET,
    });

    if (!ipRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (ipRateLimit.resetAt.getTime() - Date.now()) / 1000,
      );
      emitStructuredWarn({
        event_type: "security",
        event_message: "Password reset blocked by IP rate limit",
        endpoint: "/api/auth/password-reset/request",
        metadata: { clientIp, retryAfterSeconds },
      });
      await logSecurityEvent({
        event_type: EVENT_PASSWORD_RESET_REQUESTED,
        event_data: { reason: "rate_limited_ip", email: normalizedEmail },
        request,
      });
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const emailRateLimit = await checkRateLimit({
      identifier: `password_reset_email:${normalizedEmail}`,
      endpoint: "/api/auth/password-reset/request",
      ...RATE_LIMIT_PASSWORD_RESET,
    });

    if (!emailRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(
        (emailRateLimit.resetAt.getTime() - Date.now()) / 1000,
      );
      emitStructuredWarn({
        event_type: "security",
        event_message: "Password reset blocked by email rate limit",
        endpoint: "/api/auth/password-reset/request",
        metadata: { retryAfterSeconds },
      });
      await logSecurityEvent({
        event_type: EVENT_PASSWORD_RESET_REQUESTED,
        event_data: { reason: "rate_limited_email", email: normalizedEmail },
        request,
      });
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    // --- CAPTCHA Check ---

    const attemptCount =
      RATE_LIMIT_PASSWORD_RESET.maxRequests - emailRateLimit.remaining - 1;

    if (attemptCount >= CAPTCHA_THRESHOLD && !turnstileToken) {
      emitStructuredInfo({
        event_type: "security",
        event_message: "CAPTCHA required for password reset attempt",
        endpoint: "/api/auth/password-reset/request",
        metadata: { clientIp, attemptCount },
      });
      await Promise.all([
        incrementRateLimit({
          identifier: `password_reset_ip:${clientIp}`,
          endpoint: "/api/auth/password-reset/request",
          ...RATE_LIMIT_PASSWORD_RESET,
        }),
        incrementRateLimit({
          identifier: `password_reset_email:${normalizedEmail}`,
          endpoint: "/api/auth/password-reset/request",
          ...RATE_LIMIT_PASSWORD_RESET,
        }),
      ]);
      await logSecurityEvent({
        event_type: EVENT_PASSWORD_RESET_REQUESTED,
        event_data: { reason: "captcha_required", email: normalizedEmail },
        request,
      });
      return NextResponse.json(
        { error: "CAPTCHA required", requiresCaptcha: true },
        { status: 400 },
      );
    }

    // --- CAPTCHA Verification ---

    if (turnstileToken) {
      const captchaValid = await verifyTurnstile(turnstileToken, clientIp);
      if (!captchaValid) {
        emitStructuredWarn({
          event_type: "security",
          event_message: "Password reset CAPTCHA validation failed",
          endpoint: "/api/auth/password-reset/request",
          metadata: { clientIp },
        });
        await Promise.all([
          incrementRateLimit({
            identifier: `password_reset_ip:${clientIp}`,
            endpoint: "/api/auth/password-reset/request",
            ...RATE_LIMIT_PASSWORD_RESET,
          }),
          incrementRateLimit({
            identifier: `password_reset_email:${normalizedEmail}`,
            endpoint: "/api/auth/password-reset/request",
            ...RATE_LIMIT_PASSWORD_RESET,
          }),
        ]);
        await logSecurityEvent({
          event_type: EVENT_PASSWORD_RESET_REQUESTED,
          event_data: { reason: "captcha_failed", email: normalizedEmail },
          request,
        });
        return NextResponse.json(
          { error: "Invalid CAPTCHA. Please try again." },
          { status: 400 },
        );
      }
    }

    // --- Increment Rate Limits ---

    await Promise.all([
      incrementRateLimit({
        identifier: `password_reset_ip:${clientIp}`,
        endpoint: "/api/auth/password-reset/request",
        ...RATE_LIMIT_PASSWORD_RESET,
      }),
      incrementRateLimit({
        identifier: `password_reset_email:${normalizedEmail}`,
        endpoint: "/api/auth/password-reset/request",
        ...RATE_LIMIT_PASSWORD_RESET,
      }),
    ]);

    // --- Send Password Reset Email ---

    const publicSupabaseUrl = resolvePublicSupabaseUrl();
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!publicSupabaseUrl || !supabaseAnonKey) {
      emitStructuredError({
        error_type: "config",
        error_message: "Password reset Supabase client config is missing",
        endpoint: "/api/auth/password-reset/request",
      });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const supabase = createClient(publicSupabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const publicOrigin = resolvePublicOrigin(request);
    if (!publicOrigin) {
      emitStructuredError({
        error_type: "config",
        error_message: "Password reset public origin resolution failed",
        endpoint: "/api/auth/password-reset/request",
      });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const redirectTo = new URL(
      "/auth/callback?next=/passwort-reset",
      publicOrigin,
    ).toString();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (resetError) {
      emitStructuredError({
        error_type: "auth",
        error_message: `Password reset email dispatch failed: ${resetError.message}`,
        endpoint: "/api/auth/password-reset/request",
        metadata: {
          code: "code" in resetError ? String(resetError.code) : undefined,
          status: "status" in resetError ? Number(resetError.status) : undefined,
        },
      });
    } else {
      emitStructuredInfo({
        event_type: "auth",
        event_message: "Password reset email dispatch requested successfully",
        endpoint: "/api/auth/password-reset/request",
      });
    }

    // --- Audit Logging ---

    const userId = await resolveUserId(normalizedEmail);

    await logSecurityEvent({
      event_type: EVENT_PASSWORD_RESET_REQUESTED,
      user_id: userId,
      event_data: { email: normalizedEmail },
      request,
    });

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (error) {
    emitStructuredError({
      error_type: "auth",
      error_message: `Password reset request error: ${error instanceof Error ? error.message : String(error)}`,
      endpoint: "/api/auth/password-reset/request",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
