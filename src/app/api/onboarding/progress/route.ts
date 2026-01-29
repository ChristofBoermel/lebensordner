import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// GET: Load onboarding progress from server
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing configuration' }, { status: 500 })
    }

    // Get user from cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('onboarding_progress')
      .eq('id', user.id)
      .single()

    if (error) {
      // Field might not exist - return null (will use localStorage fallback)
      return NextResponse.json({ progress: null })
    }

    // Parse JSON if it's a string
    let progress = profile?.onboarding_progress
    if (typeof progress === 'string') {
      try {
        progress = JSON.parse(progress)
      } catch {
        progress = null
      }
    }

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Error loading onboarding progress:', error)
    return NextResponse.json({ progress: null })
  }
}

// POST: Save onboarding progress to server
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing configuration' }, { status: 500 })
    }

    const body = await request.json()
    const { progress } = body

    if (!progress) {
      return NextResponse.json({ error: 'No progress data provided' }, { status: 400 })
    }

    // Get user from cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Store progress as JSON string
    const progressString = JSON.stringify(progress)

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ onboarding_progress: progressString })
      .eq('id', user.id)

    if (error) {
      // Field might not exist - log but don't fail (localStorage will be used)
      console.warn('Could not save onboarding progress to server:', error.message)
      return NextResponse.json({ success: false, fallback: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving onboarding progress:', error)
    return NextResponse.json({ success: false, fallback: true })
  }
}

// DELETE: Clear onboarding progress from server
export async function DELETE() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing configuration' }, { status: 500 })
    }

    // Get user from cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    await supabaseAdmin
      .from('profiles')
      .update({ onboarding_progress: null })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing onboarding progress:', error)
    return NextResponse.json({ success: false })
  }
}
