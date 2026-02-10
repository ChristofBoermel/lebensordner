import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Test endpoint for SMS - sends a test message to the authenticated user's phone

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    // Get user's profile with phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.phone) {
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

      return NextResponse.json({
        success: true,
        messageId: result.sid,
        status: result.status,
        to: formattedPhone,
      });
    } catch (twilioError: any) {
      console.error("Twilio error:", twilioError);

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
    console.error("SMS test error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 },
    );
  }
}
