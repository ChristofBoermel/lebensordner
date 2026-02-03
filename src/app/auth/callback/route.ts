import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Admin client for profile creation
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Ensure profile exists after email confirmation
      const supabaseAdmin = getSupabaseAdmin()
      
      // Check if profile already exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('id', data.user.id)
        .single()
      
      if (!existingProfile) {
        // Create profile for the user
        await supabaseAdmin
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email || '',
            full_name: data.user.user_metadata?.full_name || '',
            onboarding_completed: false,
          })

        // Link any pending trusted person invitations
        if (data.user.email) {
          console.log('Attempting to link trusted persons for new user email:', data.user.email)

          const { data: updateResult, error: linkError } = await supabaseAdmin
            .from('trusted_persons')
            .update({ linked_user_id: data.user.id })
            .eq('email', data.user.email)
            .eq('invitation_status', 'accepted')
            .is('linked_user_id', null)
            .select('id, name, user_id')

          if (linkError) {
            console.error('Error linking trusted persons:', linkError)
          } else if (updateResult && updateResult.length > 0) {
            console.log('Successfully linked trusted person records:', updateResult)
          } else {
            console.log('No pending trusted person invitations found for email:', data.user.email)
          }
        }

        // Always go to onboarding for new users
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      // For existing users, also check for pending links
      if (data.user.email) {
        console.log('Checking for pending trusted person links for existing user:', data.user.email)

        const { data: updateResult, error: linkError } = await supabaseAdmin
          .from('trusted_persons')
          .update({ linked_user_id: data.user.id })
          .eq('email', data.user.email)
          .eq('invitation_status', 'accepted')
          .is('linked_user_id', null)
          .select('id, name, user_id')

        if (linkError) {
          console.error('Error linking trusted persons for existing user:', linkError)
        } else if (updateResult && updateResult.length > 0) {
          console.log('Successfully linked trusted person records for existing user:', updateResult)
        }
      }
      
      // If onboarding completed, go to dashboard, otherwise onboarding
      if (existingProfile.onboarding_completed) {
        return NextResponse.redirect(`${origin}/dashboard`)
      }
      
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  // Return to login page if there's an error
  return NextResponse.redirect(`${origin}/anmelden?error=callback`)
}
