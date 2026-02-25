import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  incrementRateLimit,
  RATE_LIMIT_PASSWORD_RESET,
} from "@/lib/security/rate-limit";
import {
  logSecurityEvent,
  EVENT_PASSWORD_RESET_REQUESTED,
} from "@/lib/security/audit-log";

// --- Constants ---

const CAPTCHA_THRESHOLD = 2;

// --- Turnstile Verification ---

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[AUTH] TURNSTILE_SECRET_KEY not configured");
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
    console.error("[AUTH] Turnstile verification failed:", error);
    return false;
  }
}

// --- User ID Resolution ---

async function resolveUserId(email: string): Promise<string | undefined> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

    const supabase = await createServerSupabaseClient();
    const origin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";

    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${origin}/auth/callback?next=/passwort-reset`,
    });

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
    console.error("[AUTH] Password reset request error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
