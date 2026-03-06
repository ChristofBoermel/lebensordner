export interface EmergencyAccessEmailData {
  ownerName: string
  ownerEmail: string
  trustedPersonName: string
  daysSinceActive: number
  accessUrl: string
  isTest?: boolean
}

export function generateEmergencyAccessEmail(data: EmergencyAccessEmailData): string {
  const testBanner = data.isTest
    ? `
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-weight: 600;">
        Dies ist eine Testbenachrichtigung.
      </div>
    `
    : ''

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wichtige Mitteilung</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f7f4;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #5d6b5d; color: #ffffff; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Lebensordner</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; color: #7f1d1d; padding: 12px 14px; border-radius: 6px; margin-bottom: 20px;">
                Wichtige Mitteilung
              </div>
              ${testBanner}
              <p style="margin: 0 0 14px 0; color: #374151; font-size: 16px;">
                Hallo ${data.trustedPersonName},
              </p>
              <p style="margin: 0 0 14px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                ${data.ownerName} hat sich seit ${data.daysSinceActive} Tagen nicht in den gemeinsamen Lebensordner eingeloggt.
                Sie wurden als Vertrauensperson hinterlegt und haben nun Zugriff.
              </p>
              <p style="margin: 0 0 22px 0; color: #6b7280; font-size: 14px;">
                Hinterlegte E-Mail des Kontoinhabers: ${data.ownerEmail}
              </p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${data.accessUrl}" style="display: inline-block; background-color: #5d6b5d; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
                  Dokumente ansehen
                </a>
              </div>
              <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                Diese Benachrichtigung wurde automatisch durch den Notfallzugang ausgelöst.
                Falls ${data.ownerName} sich wieder einloggt, wird der Zugang automatisch zurückgesetzt.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}
