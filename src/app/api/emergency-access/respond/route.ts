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

    const { requestId, action, denialReason, expiresInHours = 72 } = await request.json()

    if (!requestId || !action) {
      return NextResponse.json({ error: 'Request ID und Aktion erforderlich' }, { status: 400 })
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()

    // Get the request and verify ownership
    const { data: accessRequest, error: fetchError } = await adminClient
      .from('emergency_access_requests')
      .select(`
        *,
        trusted_persons (
          name,
          linked_user_id
        )
      `)
      .eq('id', requestId)
      .single()

    if (fetchError || !accessRequest) {
      return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
    }

    if (accessRequest.owner_id !== user.id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    if (accessRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Anfrage wurde bereits bearbeitet' }, { status: 409 })
    }

    // Update the request
    const updateData: Record<string, any> = {
      status: action === 'approve' ? 'approved' : 'denied',
      approved_by: action === 'approve' ? user.id : null,
    }

    if (action === 'approve') {
      updateData.approved_at = new Date().toISOString()
      // Set expiration (default 72 hours)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expiresInHours)
      updateData.expires_at = expiresAt.toISOString()
    } else {
      updateData.denied_at = new Date().toISOString()
      updateData.denial_reason = denialReason || null
    }

    const { error: updateError } = await adminClient
      .from('emergency_access_requests')
      .update(updateData)
      .eq('id', requestId)

    if (updateError) {
      console.error('Error updating request:', updateError)
      return NextResponse.json({ error: 'Anfrage konnte nicht aktualisiert werden' }, { status: 500 })
    }

    // Send notification to requester
    const { data: requesterProfile } = await adminClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', accessRequest.requester_id)
      .single()

    const { data: ownerProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (requesterProfile?.email) {
      try {
        await getResend().emails.send({
          from: 'Lebensordner <notfall@lebensordner.org>',
          to: requesterProfile.email,
          subject: action === 'approve'
            ? `Notfallzugriff genehmigt - ${ownerProfile?.full_name || 'Nutzer'}`
            : `Notfallzugriff abgelehnt - ${ownerProfile?.full_name || 'Nutzer'}`,
          html: generateResponseEmail({
            requesterName: requesterProfile.full_name || 'Nutzer',
            ownerName: ownerProfile?.full_name || 'Nutzer',
            approved: action === 'approve',
            denialReason: denialReason,
            expiresAt: updateData.expires_at,
            dashboardLink: `${process.env.NEXT_PUBLIC_APP_URL}/vp-dashboard`,
          }),
        })
      } catch (emailError) {
        console.error('Failed to send response email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      status: updateData.status,
      message: action === 'approve'
        ? 'Notfallzugriff wurde genehmigt'
        : 'Notfallzugriff wurde abgelehnt'
    })
  } catch (error: any) {
    console.error('Emergency access respond error:', error)
    return NextResponse.json(
      { error: error.message || 'Serverfehler' },
      { status: 500 }
    )
  }
}

interface ResponseEmailData {
  requesterName: string
  ownerName: string
  approved: boolean
  denialReason?: string
  expiresAt?: string
  dashboardLink: string
}

function generateResponseEmail(data: ResponseEmailData): string {
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
      <div style="display: inline-block; background-color: ${data.approved ? '#16a34a' : '#dc2626'}; padding: 12px; border-radius: 12px;">
        <span style="color: white; font-size: 24px;">${data.approved ? '✓' : '✕'}</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">
        Notfallzugriff ${data.approved ? 'genehmigt' : 'abgelehnt'}
      </h1>
    </div>

    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">
        Hallo ${data.requesterName},
      </p>

      ${data.approved ? `
      <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #166534; font-size: 16px; margin: 0;">
          <strong>${data.ownerName}</strong> hat Ihre Notfallzugriff-Anfrage genehmigt.
        </p>
        ${data.expiresAt ? `
        <p style="color: #166534; font-size: 14px; margin: 12px 0 0 0;">
          Der Zugriff ist gültig bis: ${new Date(data.expiresAt).toLocaleDateString('de-DE', { dateStyle: 'full' })} um ${new Date(data.expiresAt).toLocaleTimeString('de-DE', { timeStyle: 'short' })}
        </p>
        ` : ''}
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${data.dashboardLink}"
           style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum VP-Dashboard →
        </a>
      </div>
      ` : `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #991b1b; font-size: 16px; margin: 0;">
          <strong>${data.ownerName}</strong> hat Ihre Notfallzugriff-Anfrage abgelehnt.
        </p>
        ${data.denialReason ? `
        <p style="color: #991b1b; font-size: 14px; margin: 12px 0 0 0;">
          Grund: "${data.denialReason}"
        </p>
        ` : ''}
      </div>
      `}
    </div>

    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">Lebensordner - Ihr digitaler Lebensordner</p>
    </div>
  </div>
</body>
</html>
  `
}
