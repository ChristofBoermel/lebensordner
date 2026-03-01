import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emitStructuredError } from "@/lib/errors/structured-logger";

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, or external service)
// Recommended: Call daily at 8:00 AM

// Validate required environment variables at module load
const CRON_SECRET = process.env['CRON_SECRET'];
if (!CRON_SECRET) {
  emitStructuredError({
    error_type: "config",
    error_message: "CRON_SECRET not configured",
    endpoint: "/api/cron/send-reminders",
  });
}

const getSupabaseAdmin = () => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new Error("Supabase environment variables missing");
  }
  return createClient(url, key);
};

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY missing");
  }
  return new Resend(apiKey);
};

interface ReminderWithUser {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  reminder_type: string;
  reminder_watcher_id: string | null;
  reminder_watcher_notified_at: string | null;
  user_id: string;
  profiles: {
    email: string;
    full_name: string | null;
    phone: string | null;
    email_reminders_enabled: boolean;
    email_reminder_days_before: number;
    sms_reminders_enabled: boolean;
    sms_reminder_days_before: number;
  };
  trusted_persons: {
    name: string;
    email: string;
  } | null;
}

interface ExpiringDocument {
  id: string;
  title: string;
  category: string;
  expiry_date: string;
  custom_reminder_days: number | null;
  reminder_watcher_id: string | null;
  reminder_watcher_notified_at: string | null;
  user_id: string;
  profiles: {
    email: string;
    full_name: string | null;
    phone: string | null;
    email_reminders_enabled: boolean;
    email_reminder_days_before: number;
    sms_reminders_enabled: boolean;
    sms_reminder_days_before: number;
  };
  trusted_persons: {
    name: string;
    email: string;
  } | null;
}

export async function GET(request: Request) {
  // Fail-closed: CRON_SECRET must be set
  if (!CRON_SECRET) {
    emitStructuredError({
      error_type: "auth",
      error_message: "Request rejected: CRON_SECRET is not configured",
      endpoint: "/api/cron/send-reminders",
    });
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 500 },
    );
  }

  // Check authorization: either Bearer token or Vercel cron header
  const authHeader = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  const isAuthorizedByBearer = authHeader === `Bearer ${CRON_SECRET}`;
  const isAuthorizedByVercel = vercelCronHeader === "1";

  if (!isAuthorizedByBearer && !isAuthorizedByVercel) {
    console.warn("[CRON] Unauthorized request attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    emails_sent: 0,
    sms_sent: 0,
    watcher_emails_sent: 0,
    errors: [] as string[],
  };

  try {
    const supabase = getSupabaseAdmin();
    const resend = getResend();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ========================================
    // 1. Send reminders for due dates
    // ========================================
    const { data: reminders, error: reminderError } = await supabase
      .from("reminders")
      .select(
        `
        id,
        title,
        description,
        due_date,
        reminder_type,
        reminder_watcher_id,
        reminder_watcher_notified_at,
        user_id,
        profiles!reminders_user_id_fkey (
          email,
          full_name,
          phone,
          email_reminders_enabled,
          email_reminder_days_before,
          sms_reminders_enabled,
          sms_reminder_days_before
        ),
        trusted_persons!reminders_reminder_watcher_id_fkey (
          name,
          email
        )
      `,
      )
      .eq("is_completed", false)
      .eq("email_sent", false)
      .gte("due_date", today.toISOString().split("T")[0]);

    if (reminderError) {
      throw new Error(`Reminder fetch error: ${reminderError.message}`);
    }

    if (reminders) {
      for (const reminder of reminders as unknown as ReminderWithUser[]) {
        try {
          const profile = reminder.profiles;
          if (!profile) continue;

          const dueDate = new Date(reminder.due_date);
          const daysUntilDue = Math.ceil(
            (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Send email reminder
          if (
            profile.email_reminders_enabled &&
            daysUntilDue <= profile.email_reminder_days_before
          ) {
            try {
              await resend.emails.send({
                from: "Lebensordner <erinnerung@lebensordner.org>",
                to: profile.email,
                subject: `Erinnerung: ${reminder.title}`,
                html: generateReminderEmail({
                  userName: profile.full_name || "Nutzer",
                  title: reminder.title,
                  description: reminder.description,
                  dueDate: dueDate.toLocaleDateString("de-DE", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                  daysUntilDue,
                }),
              });

              // Mark reminder as sent
              await supabase
                .from("reminders")
                .update({ email_sent: true })
                .eq("id", reminder.id);

              results.emails_sent++;
            } catch (emailError: any) {
              results.errors.push(
                `Email error for reminder ${reminder.id}: ${emailError.message}`,
              );
            }
          }

          // Send SMS reminder
          if (
            profile.sms_reminders_enabled &&
            profile.phone &&
            daysUntilDue <= profile.sms_reminder_days_before
          ) {
            try {
              const smsMessage = `Lebensordner: "${reminder.title}" ist in ${daysUntilDue} Tag${daysUntilDue > 1 ? "en" : ""} fällig.`;
              await sendSMS(profile.phone, smsMessage);
              results.sms_sent++;
            } catch (smsError: any) {
              results.errors.push(
                `SMS error for reminder ${reminder.id}: ${smsError.message}`,
              );
            }
          }

          // Send notification to reminder watcher (trusted person)
          if (
            reminder.trusted_persons &&
            daysUntilDue <= profile.email_reminder_days_before &&
            !reminder.reminder_watcher_notified_at
          ) {
            try {
              await resend.emails.send({
                from: "Lebensordner <erinnerung@lebensordner.org>",
                to: reminder.trusted_persons.email,
                subject: `Erinnerung: ${reminder.title} von ${profile.full_name || "einem Familienmitglied"}`,
                html: generateWatcherReminderEmail({
                  watcherName: reminder.trusted_persons.name,
                  ownerName: profile.full_name || "Ihr Familienmitglied",
                  documentTitle: reminder.title,
                  category: "Erinnerung",
                  expiryDate: dueDate.toLocaleDateString("de-DE", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                  daysUntilExpiry: daysUntilDue,
                }),
              });

              // Mark watcher as notified
              await supabase
                .from("reminders")
                .update({
                  reminder_watcher_notified_at: new Date().toISOString(),
                })
                .eq("id", reminder.id);

              results.watcher_emails_sent++;
            } catch (watcherError: any) {
              results.errors.push(
                `Watcher email error for reminder ${reminder.id}: ${watcherError.message}`,
              );
            }
          }
        } catch (itemError: any) {
          results.errors.push(`Error processing reminder ${reminder.id}: ${itemError.message}`);
        }
      }
    }

    // ========================================
    // 2. Send reminders for expiring documents
    // ========================================
    const { data: expiringDocs, error: docsError } = await supabase
      .from("documents")
      .select(
        `
        id,
        title,
        category,
        expiry_date,
        custom_reminder_days,
        reminder_watcher_id,
        reminder_watcher_notified_at,
        expiry_reminder_sent,
        user_id,
        profiles!documents_user_id_fkey (
          email,
          full_name,
          phone,
          email_reminders_enabled,
          email_reminder_days_before,
          sms_reminders_enabled,
          sms_reminder_days_before
        ),
        trusted_persons!documents_reminder_watcher_id_fkey (
          name,
          email
        )
      `,
      )
      .eq("expiry_reminder_sent", false)
      .not("expiry_date", "is", null)
      .gte("expiry_date", today.toISOString().split("T")[0]);

    if (docsError) {
      throw new Error(`Document fetch error: ${docsError.message}`);
    }

    if (expiringDocs) {
      for (const doc of expiringDocs as unknown as ExpiringDocument[]) {
        try {
          const profile = doc.profiles;
          if (!profile) continue;

          const expiryDate = new Date(doc.expiry_date);
          const daysUntilExpiry = Math.ceil(
            (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Use custom reminder days if set, otherwise use profile default
          const emailReminderDays =
            doc.custom_reminder_days ?? profile.email_reminder_days_before;
          const smsReminderDays =
            doc.custom_reminder_days ?? profile.sms_reminder_days_before;

          let emailSent = false;
          let smsSent = false;

          // Send email reminder
          if (
            profile.email_reminders_enabled &&
            daysUntilExpiry <= emailReminderDays
          ) {
            try {
              await resend.emails.send({
                from: "Lebensordner <erinnerung@lebensordner.org>",
                to: profile.email,
                subject: `Dokument läuft ab: ${doc.title}`,
                html: generateDocumentExpiryEmail({
                  userName: profile.full_name || "Nutzer",
                  documentTitle: doc.title,
                  category: doc.category,
                  expiryDate: expiryDate.toLocaleDateString("de-DE", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                  daysUntilExpiry,
                }),
              });
              emailSent = true;
              results.emails_sent++;
            } catch (emailError: any) {
              results.errors.push(
                `Email error for document ${doc.id}: ${emailError.message}`,
              );
            }
          }

          // Send SMS reminder
          if (
            profile.sms_reminders_enabled &&
            profile.phone &&
            daysUntilExpiry <= smsReminderDays
          ) {
            try {
              const smsMessage = `Lebensordner: "${doc.title}" läuft in ${daysUntilExpiry} Tag${daysUntilExpiry > 1 ? "en" : ""} ab.`;
              await sendSMS(profile.phone, smsMessage);
              smsSent = true;
              results.sms_sent++;
            } catch (smsError: any) {
              results.errors.push(
                `SMS error for document ${doc.id}: ${smsError.message}`,
              );
            }
          }

          // Send notification to reminder watcher (trusted person)
          let watcherNotified = false;
          if (
            doc.trusted_persons &&
            daysUntilExpiry <= emailReminderDays &&
            !doc.reminder_watcher_notified_at
          ) {
            try {
              await resend.emails.send({
                from: "Lebensordner <erinnerung@lebensordner.org>",
                to: doc.trusted_persons.email,
                subject: `Erinnerung: ${doc.title} von ${profile.full_name || "einem Familienmitglied"}`,
                html: generateWatcherReminderEmail({
                  watcherName: doc.trusted_persons.name,
                  ownerName: profile.full_name || "Ihr Familienmitglied",
                  documentTitle: doc.title,
                  category: doc.category,
                  expiryDate: expiryDate.toLocaleDateString("de-DE", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                  daysUntilExpiry,
                }),
              });
              watcherNotified = true;
              results.watcher_emails_sent++;
            } catch (watcherError: any) {
              results.errors.push(
                `Watcher email error for document ${doc.id}: ${watcherError.message}`,
              );
            }
          }

          // Mark as sent if either email or SMS was sent
          if (emailSent || smsSent) {
            await supabase
              .from("documents")
              .update({
                expiry_reminder_sent: true,
                ...(watcherNotified
                  ? { reminder_watcher_notified_at: new Date().toISOString() }
                  : {}),
              })
              .eq("id", doc.id);
          } else if (watcherNotified) {
            await supabase
              .from("documents")
              .update({ reminder_watcher_notified_at: new Date().toISOString() })
              .eq("id", doc.id);
          }
        } catch (itemError: any) {
          results.errors.push(`Error processing document ${doc.id}: ${itemError.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error: any) {
    emitStructuredError({
      error_type: "worker",
      error_message: `Cron job error: ${error?.message ?? String(error)}`,
      endpoint: "/api/cron/send-reminders",
      queue: "reminders",
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        ...results,
      },
      { status: 500 },
    );
  }
}

// ========================================
// Email Templates
// ========================================

interface ReminderEmailData {
  userName: string;
  title: string;
  description: string | null;
  dueDate: string;
  daysUntilDue: number;
}

function generateReminderEmail(data: ReminderEmailData): string {
  const urgencyColor =
    data.daysUntilDue <= 1
      ? "#dc2626"
      : data.daysUntilDue <= 3
        ? "#f59e0b"
        : "#059669";
  const urgencyText =
    data.daysUntilDue === 0
      ? "Heute fällig!"
      : data.daysUntilDue === 1
        ? "Morgen fällig!"
        : `In ${data.daysUntilDue} Tagen fällig`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #5d6b5d; padding: 12px; border-radius: 12px;">
        <span style="color: white; font-size: 24px;">🌿</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
    </div>

    <!-- Content Card -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">
        Hallo ${data.userName},
      </p>

      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="display: inline-block; background-color: ${urgencyColor}; color: white; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">
          ${urgencyText}
        </div>
        <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 8px 0;">${data.title}</h2>
        ${data.description ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">${data.description}</p>` : ""}
        <p style="color: #374151; font-size: 14px; margin: 0;">
          <strong>Fällig am:</strong> ${data.dueDate}
        </p>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://lebensordner.org"}/erinnerungen" 
         style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
        Zur Erinnerung →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        Sie erhalten diese E-Mail, weil Sie Erinnerungen in Ihrem Lebensordner aktiviert haben.
      </p>
      <p style="margin: 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://lebensordner.org"}/einstellungen" style="color: #6b7280;">
          E-Mail-Einstellungen ändern
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

interface DocumentExpiryEmailData {
  userName: string;
  documentTitle: string;
  category: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

function generateDocumentExpiryEmail(data: DocumentExpiryEmailData): string {
  const urgencyColor =
    data.daysUntilExpiry <= 7
      ? "#dc2626"
      : data.daysUntilExpiry <= 30
        ? "#f59e0b"
        : "#059669";
  const urgencyText =
    data.daysUntilExpiry <= 7
      ? "Dringend!"
      : data.daysUntilExpiry <= 30
        ? "Bald fällig"
        : "Zur Information";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #5d6b5d; padding: 12px; border-radius: 12px;">
        <span style="color: white; font-size: 24px;">🌿</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
    </div>

    <!-- Content Card -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">
        Hallo ${data.userName},
      </p>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        eines Ihrer Dokumente läuft bald ab und sollte erneuert werden:
      </p>

      <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="display: inline-block; background-color: ${urgencyColor}; color: white; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">
          ${urgencyText}
        </div>
        <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 8px 0;">📄 ${data.documentTitle}</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">
          Kategorie: ${data.category}
        </p>
        <p style="color: #374151; font-size: 14px; margin: 0;">
          <strong>Läuft ab am:</strong> ${data.expiryDate}<br>
          <strong>Verbleibend:</strong> ${data.daysUntilExpiry} Tage
        </p>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
        💡 <strong>Tipp:</strong> Kümmern Sie sich rechtzeitig um die Erneuerung, um Verzögerungen zu vermeiden.
      </p>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://lebensordner.org"}/dokumente"
         style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
        Dokumente ansehen →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        Sie erhalten diese E-Mail, weil Sie Erinnerungen in Ihrem Lebensordner aktiviert haben.
      </p>
      <p style="margin: 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://lebensordner.org"}/einstellungen" style="color: #6b7280;">
          E-Mail-Einstellungen ändern
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

interface WatcherReminderEmailData {
  watcherName: string;
  ownerName: string;
  documentTitle: string;
  category: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

function generateWatcherReminderEmail(data: WatcherReminderEmailData): string {
  const urgencyColor =
    data.daysUntilExpiry <= 7
      ? "#dc2626"
      : data.daysUntilExpiry <= 30
        ? "#f59e0b"
        : "#059669";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #5d6b5d; padding: 12px; border-radius: 12px;">
        <span style="color: white; font-size: 24px;">🌿</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
    </div>

    <!-- Content Card -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">
        Hallo ${data.watcherName},
      </p>

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Sie wurden gebeten, <strong>${data.ownerName}</strong> an einen wichtigen Termin zu erinnern.
        Das folgende Dokument läuft bald ab:
      </p>

      <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="display: inline-block; background-color: ${urgencyColor}; color: white; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">
          In ${data.daysUntilExpiry} Tagen fällig
        </div>
        <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 8px 0;">📄 ${data.documentTitle}</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">
          Kategorie: ${data.category}
        </p>
        <p style="color: #374151; font-size: 14px; margin: 0;">
          <strong>Läuft ab am:</strong> ${data.expiryDate}
        </p>
      </div>

      <p style="color: #374151; font-size: 14px; margin: 0;">
        Bitte erinnern Sie ${data.ownerName} rechtzeitig, sich um die Erneuerung dieses Dokuments zu kümmern.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">
        Sie erhalten diese E-Mail, weil Sie als Erinnerungs-Begleiter für ${data.ownerName} eingetragen wurden.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ========================================
// SMS Helper Function
// ========================================

async function sendSMS(phone: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const twilioSenderId = process.env.TWILIO_SENDER_ID;

  if (!accountSid || !authToken || (!twilioPhoneNumber && !twilioSenderId)) {
    throw new Error("Twilio not configured");
  }

  // Format phone number for Germany
  let formattedPhone = phone.replace(/\s+/g, "").replace(/^0/, "+49");
  if (!formattedPhone.startsWith("+")) {
    formattedPhone = "+49" + formattedPhone;
  }

  const twilio = await import("twilio");
  const client = twilio.default(accountSid, authToken);

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_SENDER_ID || twilioPhoneNumber, // ✅ New way with fallback
    to: formattedPhone,
  });
}
