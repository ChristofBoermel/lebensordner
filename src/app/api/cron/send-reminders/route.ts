import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, or external service)
// Recommended: Call daily at 8:00 AM

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

interface ReminderWithUser {
  id: string
  title: string
  description: string | null
  due_date: string
  reminder_type: string
  user_id: string
  profiles: {
    email: string
    full_name: string | null
    phone: string | null
    email_reminders_enabled: boolean
    email_reminder_days_before: number
    sms_reminders_enabled: boolean
    sms_reminder_days_before: number
  }
}

interface ExpiringDocument {
  id: string
  title: string
  category: string
  expiry_date: string
  user_id: string
  profiles: {
    email: string
    full_name: string | null
    phone: string | null
    email_reminders_enabled: boolean
    email_reminder_days_before: number
    sms_reminders_enabled: boolean
    sms_reminder_days_before: number
  }
}

export async function GET(request: Request) {
  // Verify authorization - allow cron secret OR authenticated user
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  let isAuthorized = false

  // Check cron secret
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true
  }

  // If no cron secret configured, allow the request (for development)
  if (!cronSecret) {
    isAuthorized = true
  }

  // Also allow authenticated Supabase users (for manual testing)
  if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        isAuthorized = true
      }
    } catch (e) {
      // Token invalid, continue
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    emails_sent: 0,
    sms_sent: 0,
    errors: [] as string[],
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ========================================
    // 1. Send reminders for due dates
    // ========================================
    const { data: reminders, error: reminderError } = await supabaseAdmin
      .from('reminders')
      .select(`
        id,
        title,
        description,
        due_date,
        reminder_type,
        user_id,
        profiles!reminders_user_id_fkey (
          email,
          full_name,
          phone,
          email_reminders_enabled,
          email_reminder_days_before,
          sms_reminders_enabled,
          sms_reminder_days_before
        )
      `)
      .eq('is_completed', false)
      .eq('email_sent', false)
      .gte('due_date', today.toISOString().split('T')[0])

    if (reminderError) {
      results.errors.push(`Reminder fetch error: ${reminderError.message}`)
    }

    if (reminders) {
      for (const reminder of reminders as unknown as ReminderWithUser[]) {
        const profile = reminder.profiles
        if (!profile) continue

        const dueDate = new Date(reminder.due_date)
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        // Send email reminder
        if (profile.email_reminders_enabled && daysUntilDue <= profile.email_reminder_days_before) {
          try {
            await resend.emails.send({
              from: 'Lebensordner <erinnerung@lebensordner.org>',
              to: profile.email,
              subject: `Erinnerung: ${reminder.title}`,
              html: generateReminderEmail({
                userName: profile.full_name || 'Nutzer',
                title: reminder.title,
                description: reminder.description,
                dueDate: dueDate.toLocaleDateString('de-DE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
                daysUntilDue,
              }),
            })

            // Mark reminder as sent
            await supabaseAdmin
              .from('reminders')
              .update({ email_sent: true })
              .eq('id', reminder.id)

            results.emails_sent++
          } catch (emailError: any) {
            results.errors.push(`Email error for reminder ${reminder.id}: ${emailError.message}`)
          }
        }

        // Send SMS reminder
        if (profile.sms_reminders_enabled && profile.phone && daysUntilDue <= profile.sms_reminder_days_before) {
          try {
            const smsMessage = `Lebensordner: "${reminder.title}" ist in ${daysUntilDue} Tag${daysUntilDue > 1 ? 'en' : ''} fällig.`
            await sendSMS(profile.phone, smsMessage)
            results.sms_sent++
          } catch (smsError: any) {
            results.errors.push(`SMS error for reminder ${reminder.id}: ${smsError.message}`)
          }
        }
      }
    }

    // ========================================
    // 2. Send reminders for expiring documents
    // ========================================
    const { data: expiringDocs, error: docsError } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        title,
        category,
        expiry_date,
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
        )
      `)
      .eq('expiry_reminder_sent', false)
      .not('expiry_date', 'is', null)
      .gte('expiry_date', today.toISOString().split('T')[0])

    if (docsError) {
      results.errors.push(`Document fetch error: ${docsError.message}`)
    }

    if (expiringDocs) {
      for (const doc of expiringDocs as unknown as ExpiringDocument[]) {
        const profile = doc.profiles
        if (!profile) continue

        const expiryDate = new Date(doc.expiry_date)
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        let emailSent = false
        let smsSent = false

        // Send email reminder
        if (profile.email_reminders_enabled && daysUntilExpiry <= profile.email_reminder_days_before) {
          try {
            await resend.emails.send({
              from: 'Lebensordner <erinnerung@lebensordner.org>',
              to: profile.email,
              subject: `Dokument läuft ab: ${doc.title}`,
              html: generateDocumentExpiryEmail({
                userName: profile.full_name || 'Nutzer',
                documentTitle: doc.title,
                category: doc.category,
                expiryDate: expiryDate.toLocaleDateString('de-DE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
                daysUntilExpiry,
              }),
            })
            emailSent = true
            results.emails_sent++
          } catch (emailError: any) {
            results.errors.push(`Email error for document ${doc.id}: ${emailError.message}`)
          }
        }

        // Send SMS reminder
        if (profile.sms_reminders_enabled && profile.phone && daysUntilExpiry <= profile.sms_reminder_days_before) {
          try {
            const smsMessage = `Lebensordner: "${doc.title}" läuft in ${daysUntilExpiry} Tag${daysUntilExpiry > 1 ? 'en' : ''} ab.`
            await sendSMS(profile.phone, smsMessage)
            smsSent = true
            results.sms_sent++
          } catch (smsError: any) {
            results.errors.push(`SMS error for document ${doc.id}: ${smsError.message}`)
          }
        }

        // Mark as sent if either email or SMS was sent
        if (emailSent || smsSent) {
          await supabaseAdmin
            .from('documents')
            .update({ expiry_reminder_sent: true })
            .eq('id', doc.id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        ...results,
      },
      { status: 500 }
    )
  }
}

// ========================================
// Email Templates
// ========================================

interface ReminderEmailData {
  userName: string
  title: string
  description: string | null
  dueDate: string
  daysUntilDue: number
}

function generateReminderEmail(data: ReminderEmailData): string {
  const urgencyColor = data.daysUntilDue <= 1 ? '#dc2626' : data.daysUntilDue <= 3 ? '#f59e0b' : '#059669'
  const urgencyText = data.daysUntilDue === 0 ? 'Heute fällig!' : 
                      data.daysUntilDue === 1 ? 'Morgen fällig!' : 
                      `In ${data.daysUntilDue} Tagen fällig`

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
        ${data.description ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">${data.description}</p>` : ''}
        <p style="color: #374151; font-size: 14px; margin: 0;">
          <strong>Fällig am:</strong> ${data.dueDate}
        </p>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'}/erinnerungen" 
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
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'}/einstellungen" style="color: #6b7280;">
          E-Mail-Einstellungen ändern
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}

interface DocumentExpiryEmailData {
  userName: string
  documentTitle: string
  category: string
  expiryDate: string
  daysUntilExpiry: number
}

function generateDocumentExpiryEmail(data: DocumentExpiryEmailData): string {
  const urgencyColor = data.daysUntilExpiry <= 7 ? '#dc2626' : data.daysUntilExpiry <= 30 ? '#f59e0b' : '#059669'
  const urgencyText = data.daysUntilExpiry <= 7 ? 'Dringend!' : 
                      data.daysUntilExpiry <= 30 ? 'Bald fällig' : 
                      'Zur Information'

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

      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'}/dokumente"
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
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://lebensordner.org'}/einstellungen" style="color: #6b7280;">
          E-Mail-Einstellungen ändern
        </a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}

// ========================================
// SMS Helper Function
// ========================================

async function sendSMS(phone: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    throw new Error('Twilio not configured')
  }

  // Format phone number for Germany
  let formattedPhone = phone.replace(/\s+/g, '').replace(/^0/, '+49')
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+49' + formattedPhone
  }

  const twilio = await import('twilio')
  const client = twilio.default(accountSid, authToken)

  await client.messages.create({
    body: message,
    from: twilioPhoneNumber,
    to: formattedPhone
  })
}
