import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit-log";
import { emitStructuredError } from "@/lib/errors/structured-logger";

// Test endpoint for SMS - sends a test message to the authenticated user's phone

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for") || "";
    const clientIp = forwarded.split(",")[0]?.trim() || "127.0.0.1";

    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      await logSecurityEvent({
        event_type: "sms_test_rejected",
        event_data: { reason: "unauthenticated" },
        request: request as any,
      });
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const ipLimit = await checkRateLimit({
      identifier: `sms_test_ip:${clientIp}`,
      endpoint: "/api/sms/test",
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
      failMode: "closed",
    });

    if (ipLimit.available === false) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }

    if (!ipLimit.allowed) {
      await logSecurityEvent({
        user_id: user.id,
        event_type: "sms_test_rejected",
        event_data: { reason: "rate_limited_ip" },
        request: request as any,
      });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const userLimit = await checkRateLimit({
      identifier: `sms_test_user:${user.id}`,
      endpoint: "/api/sms/test",
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
      failMode: "closed",
    });

    if (userLimit.available === false) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }

    if (!userLimit.allowed) {
      await logSecurityEvent({
        user_id: user.id,
        event_type: "sms_test_rejected",
        event_data: { reason: "rate_limited_user" },
        request: request as any,
      });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Get user's profile with phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.phone) {
      await logSecurityEvent({
        user_id: user.id,
        event_type: "sms_test_rejected",
        event_data: { reason: "missing_phone" },
        request: request as any,
      });
      return NextResponse.json(
        { error: "Keine Telefonnummer hinterlegt" },
        { status: 400 },
      );
    }

    // Check if Twilio is configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const twilioSenderId = process.env.TWILIO_SENDER_ID;

    if (!accountSid || !authToken || (!twilioPhoneNumber && !twilioSenderId)) {
      await logSecurityEvent({
        user_id: user.id,
        event_type: "sms_test_failure",
        event_data: { reason: "twilio_not_configured" },
        request: request as any,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Twilio nicht konfiguriert",
          configured: false,
        },
        { status: 500 },
      );
    }

    // Format phone number
    let formattedPhone = profile.phone.replace(/\s+/g, "").replace(/^0/, "+49");
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+49" + formattedPhone;
    }

    // Send test SMS via Twilio
    try {
      const twilio = await import("twilio");
      const client = twilio.default(accountSid, authToken);

      const testMessage = `Hallo${profile.full_name ? " " + profile.full_name.split(" ")[0] : ""}! Dies ist eine Test-SMS von Lebensordner. Ihre SMS-Benachrichtigungen funktionieren.`;

      const result = await client.messages.create({
        body: testMessage,
        from: process.env.TWILIO_SENDER_ID || twilioPhoneNumber,
        to: formattedPhone,
      });

      await logSecurityEvent({
        user_id: user.id,
        event_type: "sms_test_success",
        event_data: { providerMessageId: result.sid },
        request: request as any,
      });

      return NextResponse.json({
        success: true,
        messageId: result.sid,
        status: result.status,
        to: formattedPhone,
      });
    } catch (twilioError: any) {
      await logSecurityEvent({
        user_id: user.id,
        event_type: "sms_test_failure",
        event_data: { reason: twilioError?.code || "twilio_error" },
        request: request as any,
      });
      emitStructuredError({
        error_type: "notification",
        error_message: `Twilio error: ${twilioError?.message ?? String(twilioError)}`,
        endpoint: "/api/sms/test",
        stack: twilioError?.stack,
      });

      // Provide helpful error messages
      let errorMessage = twilioError.message;
      if (twilioError.code === 21608) {
        errorMessage =
          'Die Telefonnummer ist nicht verifiziert. Bitte verifizieren Sie Ihre Nummer in der Twilio Console unter "Verified Caller IDs".';
      } else if (twilioError.code === 21211) {
        errorMessage =
          "Ungültiges Telefonnummernformat. Bitte verwenden Sie das internationale Format (z.B. +49170...).";
      } else if (twilioError.code === 21614) {
        errorMessage = "Diese Nummer kann keine SMS empfangen.";
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: twilioError.code,
        },
        { status: 400 },
      );
    }
  } catch (error: any) {
    emitStructuredError({
      error_type: "api",
      error_message: `SMS test error: ${error?.message ?? String(error)}`,
      endpoint: "/api/sms/test",
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 },
    );
  }
}
