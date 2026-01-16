import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Admin client for profile creation (bypasses RLS)
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST() {
  try {
    // Get current user
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      return NextResponse.json({ exists: true, created: false })
    }

    // Create profile
    const { error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        onboarding_completed: false,
      })

    if (error) {
      console.error('Failed to create profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ exists: true, created: true })
  } catch (error: any) {
    console.error('Ensure profile error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
