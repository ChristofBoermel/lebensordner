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
        
        // Always go to onboarding for new users
        return NextResponse.redirect(`${origin}/onboarding`)
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
