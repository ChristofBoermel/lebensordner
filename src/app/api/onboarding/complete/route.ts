import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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
