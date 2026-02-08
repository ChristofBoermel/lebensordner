import { sendEmailWithTimeout } from '@/lib/email/resend-service'
import { maskIpAddress } from '@/lib/security/audit-log'

// --- Types ---

export type SecurityNotificationEvent =
  | 'new_login'
  | 'password_changed'
  | 'account_locked'
  | 'account_deleted'

export interface SecurityNotificationData {
  timestamp?: string
  ipAddress?: string
  userAgent?: string
  userName?: string
  [key: string]: unknown
}

// --- Constants ---

const EMAIL_FROM = 'Lebensordner <noreply@lebensordner.de>'

// --- Helpers ---

function formatTimestamp(ts?: string): string {
  const date = ts ? new Date(ts) : new Date()
  return date.toLocaleString('de-DE', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  })
}

function wrapEmailTemplate(title: string, userName: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f4;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px;">${title}</h1>
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Hallo ${userName},</p>
          ${body}
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 20px 0 0;">
            Mit freundlichen Gr&uuml;&szlig;en,<br>Ihr Lebensordner-Team
          </p>
        </div>
        <p style="color: #a3a3a3; font-size: 12px; text-align: center; margin-top: 24px;">
          Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
        </p>
      </div>
    </body>
    </html>
  `
}

// --- Email Templates ---

function getEmailTemplate(
  event: SecurityNotificationEvent,
  data: SecurityNotificationData
): { subject: string; html: string } {
  const maskedIp = data.ipAddress ? maskIpAddress(data.ipAddress) : 'Unbekannt'
  const timestamp = formatTimestamp(data.timestamp)
  const userName = data.userName || 'Benutzer'

  switch (event) {
    case 'new_login':
      return {
        subject: 'Neue Anmeldung bei Ihrem Lebensordner-Konto',
        html: wrapEmailTemplate('Neue Anmeldung erkannt', userName, `
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Es wurde eine neue Anmeldung bei Ihrem Lebensordner-Konto erkannt.
          </p>
          <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #525252; font-size: 14px; margin: 0 0 8px;"><strong>Zeitpunkt:</strong> ${timestamp}</p>
            <p style="color: #525252; font-size: 14px; margin: 0 0 8px;"><strong>IP-Adresse:</strong> ${maskedIp}</p>
            <p style="color: #525252; font-size: 14px; margin: 0;"><strong>Ger&auml;t:</strong> ${data.userAgent || 'Unbekannt'}</p>
          </div>
          <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0;">
              <strong>Waren Sie das nicht?</strong> &Auml;ndern Sie sofort Ihr Passwort und aktivieren Sie die Zwei-Faktor-Authentifizierung in Ihren Kontoeinstellungen.
            </p>
          </div>
        `),
      }

    case 'password_changed':
      return {
        subject: 'Ihr Lebensordner-Passwort wurde ge\u00e4ndert',
        html: wrapEmailTemplate('Passwort ge\u00e4ndert', userName, `
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Ihr Passwort wurde erfolgreich ge&auml;ndert.
          </p>
          <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #525252; font-size: 14px; margin: 0 0 8px;"><strong>Zeitpunkt:</strong> ${timestamp}</p>
            <p style="color: #525252; font-size: 14px; margin: 0;"><strong>IP-Adresse:</strong> ${maskedIp}</p>
          </div>
          <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0;">
              <strong>Haben Sie Ihr Passwort nicht ge&auml;ndert?</strong> Kontaktieren Sie uns umgehend und setzen Sie Ihr Passwort &uuml;ber die Funktion &bdquo;Passwort vergessen&ldquo; zur&uuml;ck.
            </p>
          </div>
        `),
      }

    case 'account_locked':
      return {
        subject: 'Ihr Lebensordner-Konto wurde gesperrt',
        html: wrapEmailTemplate('Konto gesperrt', userName, `
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Ihr Konto wurde aufgrund mehrerer fehlgeschlagener Anmeldeversuche vor&uuml;bergehend gesperrt.
          </p>
          <div style="background: #fee2e2; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #991b1b; font-size: 14px; margin: 0 0 8px;"><strong>Grund:</strong> Zu viele fehlgeschlagene Anmeldeversuche</p>
            <p style="color: #991b1b; font-size: 14px; margin: 0;"><strong>Zeitpunkt:</strong> ${timestamp}</p>
          </div>
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Um Ihr Konto zu entsperren, setzen Sie bitte Ihr Passwort &uuml;ber die Funktion &bdquo;Passwort vergessen&ldquo; auf der Anmeldeseite zur&uuml;ck.
          </p>
        `),
      }

    case 'account_deleted':
      return {
        subject: 'Ihr Lebensordner-Konto wurde gel\u00f6scht',
        html: wrapEmailTemplate('Konto gel\u00f6scht', userName, `
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Ihr Lebensordner-Konto wurde erfolgreich gel&ouml;scht. Alle Ihre Daten, Dokumente und pers&ouml;nlichen Informationen wurden unwiderruflich entfernt.
          </p>
          <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #525252; font-size: 14px; margin: 0;"><strong>Zeitpunkt:</strong> ${timestamp}</p>
          </div>
          <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0;">
              <strong>Hinweis zur Datenspeicherung:</strong> Abrechnungsdaten werden gem&auml;&szlig; &sect;147 AO f&uuml;r 7 Jahre aufbewahrt. Diese Aktion kann nicht r&uuml;ckg&auml;ngig gemacht werden.
            </p>
          </div>
          <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Vielen Dank, dass Sie Lebensordner genutzt haben. Wenn Sie in Zukunft wieder ein Konto erstellen m&ouml;chten, besuchen Sie unsere Website.
          </p>
        `),
      }
  }
}

// --- Public API ---

export async function sendSecurityNotification(
  event: SecurityNotificationEvent,
  recipientEmail: string,
  data: SecurityNotificationData = {}
): Promise<void> {
  try {
    const { subject, html } = getEmailTemplate(event, data)

    const result = await sendEmailWithTimeout({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject,
      html,
    })

    console.log(
      JSON.stringify({
        event: 'security_notification_sent',
        notification_type: event,
        to: recipientEmail,
        success: result.success,
        error: result.error || null,
        timestamp: new Date().toISOString(),
      })
    )
  } catch (error) {
    console.error(`Failed to send security notification (${event}):`, error)
  }
}

/**
 * Notify a trusted person that the account owner has deleted their account.
 */
export async function sendTrustedPersonDeletionNotification(
  recipientEmail: string,
  recipientName: string,
  ownerName: string
): Promise<void> {
  try {
    const timestamp = formatTimestamp()
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px;">Lebensordner-Konto gel&ouml;scht</h1>
            <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Hallo ${recipientName},
            </p>
            <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Wir m&ouml;chten Sie dar&uuml;ber informieren, dass <strong>${ownerName}</strong> sein/ihr Lebensordner-Konto gel&ouml;scht hat.
            </p>
            <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="color: #525252; font-size: 14px; margin: 0 0 8px;"><strong>Zeitpunkt:</strong> ${timestamp}</p>
            </div>
            <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Als Vertrauensperson hatten Sie Zugriff auf bestimmte Dokumente und Informationen. Dieser Zugriff ist mit der Kontol&ouml;schung erloschen. Alle Daten wurden unwiderruflich entfernt.
            </p>
            <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 20px 0 0;">
              Mit freundlichen Gr&uuml;&szlig;en,<br>Ihr Lebensordner-Team
            </p>
          </div>
          <p style="color: #a3a3a3; font-size: 12px; text-align: center; margin-top: 24px;">
            Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
          </p>
        </div>
      </body>
      </html>
    `

    const result = await sendEmailWithTimeout({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject: `${ownerName} hat sein/ihr Lebensordner-Konto gel\u00f6scht`,
      html,
    })

    console.log(
      JSON.stringify({
        event: 'trusted_person_deletion_notification',
        to: recipientEmail,
        success: result.success,
        error: result.error || null,
        timestamp: new Date().toISOString(),
      })
    )
  } catch (error) {
    console.error('Failed to send trusted person deletion notification:', error)
  }
}
