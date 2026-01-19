import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const getResend = () => new Resend(process.env.RESEND_API_KEY)

const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const { trustedPersonId, reason } = await request.json()

    if (!trustedPersonId) {
      return NextResponse.json({ error: 'Trusted Person ID erforderlich' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()

    // Verify the user is actually linked to this trusted_person record
    const { data: trustedPerson, error: tpError } = await adminClient
      .from('trusted_persons')
      .select(`
        id,
        user_id,
        name,
        access_level,
        profiles!trusted_persons_user_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('id', trustedPersonId)
      .eq('linked_user_id', user.id)
      .single()

    if (tpError || !trustedPerson) {
      return NextResponse.json({ error: 'Keine Berechtigung für diese Anfrage' }, { status: 403 })
    }

    // Check for existing pending request
    const { data: existingRequest } = await adminClient
      .from('emergency_access_requests')
      .select('id, status')
      .eq('trusted_person_id', trustedPersonId)
      .eq('requester_id', user.id)
      .in('status', ['pending', 'approved'])
      .single()

    if (existingRequest) {
      return NextResponse.json({
        error: existingRequest.status === 'pending'
          ? 'Sie haben bereits eine ausstehende Anfrage'
          : 'Sie haben bereits Zugriff',
        existing_request: existingRequest
      }, { status: 409 })
    }

    // Create the emergency access request
    const { data: newRequest, error: insertError } = await adminClient
      .from('emergency_access_requests')
      .insert({
        trusted_person_id: trustedPersonId,
        requester_id: user.id,
        owner_id: trustedPerson.user_id,
        reason: reason || null,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating request:', insertError)
      return NextResponse.json({ error: 'Anfrage konnte nicht erstellt werden' }, { status: 500 })
    }

    // Send email notification to owner
    const ownerProfile = trustedPerson.profiles as any
    const requesterProfile = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    try {
      await getResend().emails.send({
        from: 'Lebensordner <notfall@lebensordner.org>',
        to: ownerProfile.email,
        subject: `Notfallzugriff-Anfrage von ${requesterProfile.data?.full_name || trustedPerson.name}`,
        html: generateNotificationEmail({
          ownerName: ownerProfile.full_name || 'Nutzer',
          requesterName: requesterProfile.data?.full_name || trustedPerson.name,
          relationship: trustedPerson.name,
          reason: reason || 'Kein Grund angegeben',
          approveLink: `${process.env.NEXT_PUBLIC_APP_URL}/zugriff?approve=${newRequest.id}`,
        }),
      })
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError)
    }

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: 'Notfallzugriff-Anfrage wurde gesendet'
    })
  } catch (error: any) {
    console.error('Emergency access request error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}

interface NotificationEmailData {
  ownerName: string
  requesterName: string
  relationship: string
  reason: string
  approveLink: string
}

function generateNotificationEmail(data: NotificationEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #dc2626; padding: 12px; border-radius: 12px;">
        <span style="color: white; font-size: 24px;">🚨</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Notfallzugriff-Anfrage</h1>
    </div>

    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">
        Hallo ${data.ownerName},
      </p>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #991b1b; font-size: 16px; margin: 0;">
          <strong>${data.requesterName}</strong> (${data.relationship}) hat Notfallzugriff auf Ihren Lebensordner angefordert.
        </p>
      </div>

      ${data.reason !== 'Kein Grund angegeben' ? `
      <div style="margin-bottom: 24px;">
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Angegebener Grund:</p>
        <p style="color: #374151; font-size: 16px; margin: 0; font-style: italic;">"${data.reason}"</p>
      </div>
      ` : ''}

      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Bitte überprüfen Sie diese Anfrage und genehmigen oder ablehnen Sie den Zugriff.
      </p>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.approveLink}"
           style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Anfrage überprüfen →
        </a>
      </div>
    </div>

    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <p style="color: #92400e; font-size: 13px; margin: 0;">
        <strong>⚠️ Wichtig:</strong> Gewähren Sie nur Zugriff, wenn Sie sicher sind, dass es sich um einen legitimen Notfall handelt.
      </p>
    </div>

    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">Lebensordner - Ihr digitaler Lebensordner</p>
    </div>
  </div>
</body>
</html>
  `
}
