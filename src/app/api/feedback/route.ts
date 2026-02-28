import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const getSupabaseAdmin = () => createClient(
  process.env['SUPABASE_URL']!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const getResend = () => new Resend(process.env.RESEND_API_KEY)

interface FeedbackRequest {
  email: string
  name?: string
  subject: string
  message: string
  userId?: string
}

export async function POST(request: Request) {
  try {
    const { email, name, subject, message, userId } = await request.json() as FeedbackRequest

    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: 'E-Mail, Betreff und Nachricht sind erforderlich' },
        { status: 400 }
      )
    }

    // Save feedback to database
    const { data: feedback, error: dbError } = await getSupabaseAdmin()
      .from('feedback')
      .insert({
        user_id: userId || null,
        email,
        name: name || null,
        subject,
        message,
        status: 'new'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Fehler beim Speichern des Feedbacks' },
        { status: 500 }
      )
    }

    // Send notification email to support
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@lebensordner.org'

    try {
      await getResend().emails.send({
        from: 'Lebensordner Feedback <feedback@lebensordner.org>',
        to: supportEmail,
        replyTo: email,
        subject: `[Feedback] ${subject}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #374151;">Neues Feedback erhalten</h2>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Von:</strong> ${name || 'Nicht angegeben'}</p>
              <p><strong>E-Mail:</strong> ${email}</p>
              <p><strong>Betreff:</strong> ${subject}</p>
              ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
            </div>

            <h3 style="color: #374151;">Nachricht:</h3>
            <div style="background-color: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px;">
              ${message.replace(/\n/g, '<br>')}
            </div>

            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              Diese E-Mail wurde automatisch vom Lebensordner Feedback-System gesendet.
            </p>
          </body>
          </html>
        `
      })

      // Send confirmation email to user
      await getResend().emails.send({
        from: 'Lebensordner <noreply@lebensordner.org>',
        to: email,
        subject: 'Ihr Feedback wurde empfangen',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background-color: #5d6b5d; padding: 12px; border-radius: 12px;">
                <span style="color: white; font-size: 24px;">🌿</span>
              </div>
              <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
            </div>

            <p style="color: #374151;">Hallo${name ? ` ${name}` : ''},</p>

            <p style="color: #374151;">
              vielen Dank für Ihr Feedback! Wir haben Ihre Nachricht erhalten und werden uns so schnell wie möglich bei Ihnen melden.
            </p>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Betreff:</strong> ${subject}</p>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              Sie müssen auf diese E-Mail nicht antworten. Wir werden uns über Ihre angegebene E-Mail-Adresse bei Ihnen melden.
            </p>

            <p style="color: #374151;">
              Mit freundlichen Grüßen,<br>
              Ihr Lebensordner Team
            </p>
          </body>
          </html>
        `
      })
    } catch (emailError) {
      console.error('Email send error:', emailError)
      // Don't fail the request if email fails - feedback is already saved
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
      message: 'Feedback erfolgreich gesendet'
    })
  } catch (error: any) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
