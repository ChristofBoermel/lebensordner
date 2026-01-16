import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    // Get current user
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Auth error: ' + authError.message }, { status: 401 })
    }

    if (!user) {
      console.error('No user found')
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    console.log('Completing onboarding for user:', user.id)

    // Check for service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set!')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Use admin client to update profile (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // First check if profile exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id, onboarding_completed')
      .eq('id', user.id)
      .single()

    if (checkError) {
      console.error('Error checking profile:', checkError)
      
      // Profile doesn't exist, create it
      if (checkError.code === 'PGRST116') {
        console.log('Profile not found, creating...')
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            onboarding_completed: true,
          })
        
        if (insertError) {
          console.error('Failed to create profile:', insertError)
          return NextResponse.json({ error: 'Failed to create profile: ' + insertError.message }, { status: 500 })
        }
        
        console.log('Profile created with onboarding_completed = true')
        return NextResponse.json({ success: true, created: true })
      }
      
      return NextResponse.json({ error: 'Check error: ' + checkError.message }, { status: 500 })
    }

    console.log('Existing profile:', existingProfile)

    // Update existing profile
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id)
      .select()

    if (updateError) {
      console.error('Failed to update onboarding:', updateError)
      return NextResponse.json({ error: 'Update error: ' + updateError.message }, { status: 500 })
    }

    console.log('Profile updated:', updateData)
    return NextResponse.json({ success: true, updated: true })
  } catch (error: any) {
    console.error('Onboarding completion error:', error)
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 })
  }
}
