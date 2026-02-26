import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentConsent, recordConsent } from '@/lib/consent/manager'
import { CONSENT_VERSION, CONSENT_COOKIE_NAME, PRIVACY_POLICY_VERSION } from '@/lib/consent/constants'
import { isAccountLocked } from '@/lib/security/auth-lockout'

// Admin client for profile creation
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const normalizeReturnTo = (value: string | null) => {
  if (!value) return null
  if (value.startsWith('/')) return value
  return null
}

const normalizeOrigin = (value: string | undefined) => {
  if (!value) return null
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

const resolvePublicOrigin = (requestUrl: string) => {
  const envOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.SITE_URL)

  if (envOrigin) return envOrigin

  return normalizeOrigin(new URL(requestUrl).origin) ?? 'http://localhost:3000'
}

async function syncConsentFromCookie(userId: string) {
  try {
    const cookieStore = await cookies()
    const consentCookie = cookieStore.get(CONSENT_COOKIE_NAME)
    if (!consentCookie?.value) return

    const consent = JSON.parse(consentCookie.value)
    const version = consent.version || CONSENT_VERSION

    const promises = []
    if (typeof consent.analytics === 'boolean') {
      promises.push(recordConsent(userId, 'analytics', consent.analytics, version))
    }
    if (typeof consent.marketing === 'boolean') {
      promises.push(recordConsent(userId, 'marketing', consent.marketing, version))
    }

    await Promise.allSettled(promises)
  } catch (error) {
    console.error('[AUTH] Consent sync error:', error)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = resolvePublicOrigin(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const returnTo = normalizeReturnTo(next)

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Check if the account is locked before allowing session creation
      if (data.user.email) {
        const locked = await isAccountLocked(data.user.email)
        if (locked) {
          console.log(`Blocked session creation for locked account during callback: ${data.user.email}`)
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/anmelden?error=account_locked`)
        }
      }

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

        // Sync cookie consent to server ledger
        await syncConsentFromCookie(data.user.id)

        // Always go to onboarding for new users
        return NextResponse.redirect(`${origin}${returnTo ?? '/onboarding'}`)
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
      
      // Sync cookie consent to server ledger
      await syncConsentFromCookie(data.user.id)

      // If onboarding completed, go to dashboard, otherwise onboarding
      if (existingProfile.onboarding_completed) {
        const latestPolicyConsent = await getCurrentConsent(data.user.id, 'privacy_policy')
        if (!latestPolicyConsent || latestPolicyConsent.version !== PRIVACY_POLICY_VERSION) {
          const policyUpdateUrl = new URL(`${origin}/policy-update`)
          if (returnTo) {
            policyUpdateUrl.searchParams.set('returnTo', returnTo)
          }
          return NextResponse.redirect(policyUpdateUrl)
        }
        return NextResponse.redirect(`${origin}${returnTo ?? '/dashboard'}`)
      }

      return NextResponse.redirect(`${origin}${returnTo ?? '/onboarding'}`)
    }
  }

  // Return to login page if there's an error
  return NextResponse.redirect(`${origin}/anmelden?error=callback`)
}
