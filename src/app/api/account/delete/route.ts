import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST() {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const userEmail = profile?.email || user.email
    const userName = profile?.full_name || 'Benutzer'

    // Delete user's documents from storage
    const { data: documents } = await supabase
      .from('documents')
      .select('file_path')
      .eq('user_id', user.id)

    if (documents && documents.length > 0) {
      const filePaths = documents.map(d => d.file_path).filter(Boolean)
      if (filePaths.length > 0) {
        await supabase.storage.from('documents').remove(filePaths)
      }
    }

    // Delete profile picture if exists
    const { data: profileData } = await supabase
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', user.id)
      .single()

    if (profileData?.profile_picture_url) {
      const picturePath = profileData.profile_picture_url.split('/').pop()
      if (picturePath) {
        await supabase.storage.from('avatars').remove([`${user.id}/${picturePath}`])
      }
    }

    // Delete all user data from tables (cascade should handle most, but be explicit)
    await supabase.from('documents').delete().eq('user_id', user.id)
    await supabase.from('reminders').delete().eq('user_id', user.id)
    await supabase.from('trusted_persons').delete().eq('user_id', user.id)
    await supabase.from('emergency_contacts').delete().eq('user_id', user.id)
    await supabase.from('medical_info').delete().eq('user_id', user.id)
    await supabase.from('advance_directives').delete().eq('user_id', user.id)
    await supabase.from('funeral_wishes').delete().eq('user_id', user.id)
    await supabase.from('custom_categories').delete().eq('user_id', user.id)
    await supabase.from('subcategories').delete().eq('user_id', user.id)

    // Delete the profile
    await supabase.from('profiles').delete().eq('id', user.id)

    // Send confirmation email
    if (userEmail) {
      try {
        await resend.emails.send({
          from: 'Lebensordner <noreply@lebensordner.de>',
          to: userEmail,
          subject: 'Ihr Lebensordner-Konto wurde gelöscht',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f4;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px;">
                    Konto gelöscht
                  </h1>

                  <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Hallo ${userName},
                  </p>

                  <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Ihr Lebensordner-Konto wurde erfolgreich gelöscht. Alle Ihre Daten, Dokumente und persönlichen Informationen wurden unwiderruflich entfernt.
                  </p>

                  <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="color: #92400e; font-size: 14px; margin: 0;">
                      <strong>Hinweis:</strong> Diese Aktion kann nicht rückgängig gemacht werden. Wenn Sie Lebensordner wieder nutzen möchten, müssen Sie ein neues Konto erstellen.
                    </p>
                  </div>

                  <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Vielen Dank, dass Sie Lebensordner genutzt haben. Wir würden uns freuen, Sie in Zukunft wieder begrüßen zu dürfen.
                  </p>

                  <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0;">
                    Mit freundlichen Grüßen,<br>
                    Ihr Lebensordner-Team
                  </p>
                </div>

                <p style="color: #a3a3a3; font-size: 12px; text-align: center; margin-top: 24px;">
                  Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
                </p>
              </div>
            </body>
            </html>
          `,
        })
      } catch (emailError) {
        console.error('Failed to send deletion confirmation email:', emailError)
        // Don't fail the deletion if email fails
      }
    }

    // Sign out the user
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Kontos' },
      { status: 500 }
    )
  }
}
