import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { sendEmailWithTimeout } from '@/lib/email/resend-service'
import { readFile } from 'fs/promises'
import path from 'path'

export async function POST() {
  console.log('=== ONBOARDING COMPLETE API CALLED ===')
  
  try {
    // Check environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Supabase URL:', supabaseUrl ? 'SET' : 'MISSING')
    console.log('Anon Key:', supabaseAnonKey ? 'SET' : 'MISSING')
    console.log('Service Key:', supabaseServiceKey ? 'SET' : 'MISSING')

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ 
        error: 'Missing Supabase configuration',
        details: { url: !!supabaseUrl, anonKey: !!supabaseAnonKey }
      }, { status: 500 })
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel',
      }, { status: 500 })
    }

    // Get user from cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('Auth result:', { userId: user?.id, error: authError?.message })

    if (authError) {
      return NextResponse.json({ 
        error: 'Authentication error',
        details: authError.message 
      }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('User ID:', user.id)
    console.log('User Email:', user.email)

    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check current profile state
    const { data: currentProfile, error: selectError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('Current profile:', currentProfile)
    console.log('Select error:', selectError)

    if (selectError && selectError.code !== 'PGRST116') {
      return NextResponse.json({ 
        error: 'Failed to fetch profile',
        details: selectError.message,
        code: selectError.code
      }, { status: 500 })
    }

    // If no profile exists, create one
    if (!currentProfile) {
      console.log('No profile found, creating new one...')
      
      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          onboarding_completed: true,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.json({ 
          error: 'Failed to create profile',
          details: insertError.message,
          code: insertError.code
        }, { status: 500 })
      }

      console.log('Created new profile:', newProfile)

      // Send welcome email (non-blocking)
      try {
        const userEmail = newProfile?.email || user.email
        const userName = newProfile?.full_name || 'Nutzer'
        if (userEmail) {
          sendWelcomeEmail(userEmail, userName).catch((err) => {
            console.error('Welcome email failed (background):', err)
          })
        }
      } catch (emailErr) {
        console.error('Welcome email setup error:', emailErr)
      }

      return NextResponse.json({
        success: true,
        action: 'created',
        profile: newProfile
      })
    }

    // Profile exists, update it
    console.log('Profile exists, updating onboarding_completed to true...')
    
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update profile',
        details: updateError.message,
        code: updateError.code
      }, { status: 500 })
    }

    console.log('Updated profile:', updatedProfile)

    // Send welcome email (non-blocking, don't fail completion on email errors)
    try {
      const userEmail = updatedProfile?.email || currentProfile?.email || user.email
      const userName = updatedProfile?.full_name || currentProfile?.full_name || 'Nutzer'
      if (userEmail) {
        sendWelcomeEmail(userEmail, userName).catch((err) => {
          console.error('Welcome email failed (background):', err)
        })
      }
    } catch (emailErr) {
      console.error('Welcome email setup error:', emailErr)
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      profile: updatedProfile
    })

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({
      error: 'Unexpected server error',
      details: error.message
    }, { status: 500 })
  }
}

async function sendWelcomeEmail(email: string, userName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.lebensordner.org'
  const guidePath = path.join(process.cwd(), 'public', 'guides', 'onboarding-guide.pdf')
  const guideBuffer = await readFile(guidePath).catch((error) => {
    console.error('Onboarding guide attachment missing or unreadable:', guidePath, error)
    throw error
  })
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #5d6b5d; padding: 12px; border-radius: 12px;">
        <span style="color: white; font-size: 24px;">\ud83c\udf3f</span>
      </div>
      <h1 style="color: #374151; font-size: 24px; margin: 16px 0 0 0;">Lebensordner</h1>
    </div>
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 18px; margin: 0 0 24px 0;">
        Herzlich willkommen bei Lebensordner, ${userName}!
      </p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Sie haben die Einrichtung erfolgreich abgeschlossen. Ihr digitaler Lebensordner ist jetzt bereit.
      </p>
      <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">Ihre n\u00e4chsten Schritte</h3>
        <ul style="color: #374151; font-size: 14px; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 10px;"><strong>Dokumente hochladen</strong> \u2013 Beginnen Sie mit Personalausweis oder Versicherungskarte</li>
          <li style="margin-bottom: 10px;"><strong>Vertrauensperson einladen</strong> \u2013 W\u00e4hlen Sie jemanden f\u00fcr den Notfall</li>
          <li style="margin-bottom: 10px;"><strong>Medizinische Daten erg\u00e4nzen</strong> \u2013 Blutgruppe, Allergien und Medikamente</li>
          <li><strong>Notfall-QR-Code drucken</strong> \u2013 F\u00fcr Ihre Geldb\u00f6rse oder Krankenkassenkarte</li>
        </ul>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #5d6b5d; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Dashboard \u2192
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
        Nehmen Sie sich Zeit \u2013 jeder kleine Schritt z\u00e4hlt.
      </p>
    </div>
    <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">Lebensordner - Ihr digitaler Lebensordner f\u00fcr wichtige Dokumente</p>
      <p style="margin: 0;"><a href="${appUrl}" style="color: #6b7280;">www.lebensordner.org</a></p>
    </div>
  </div>
</body>
</html>`

  await sendEmailWithTimeout({
    from: 'Lebensordner <willkommen@lebensordner.org>',
    to: email,
    subject: 'Willkommen bei Lebensordner - Ihre Anleitung',
    html,
    attachments: [
      {
        filename: 'onboarding-guide.pdf',
        content: guideBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}
