import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { logSecurityEvent } from '@/lib/security/audit-log'
import {
  sendSecurityNotification,
  sendTrustedPersonDeletionNotification,
} from '@/lib/email/security-notifications'
import { getStripe } from '@/lib/stripe'

// --- Helper ---

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// --- Handler ---

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Step 1: Password Verification
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ error: 'Passwort erforderlich' }, { status: 400 })
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    })

    if (signInError) {
      await logSecurityEvent({
        user_id: user.id,
        event_type: 'account_deletion_failed',
        event_data: { reason: 'invalid_password' },
        request,
      })
      return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 })
    }

    // Step 2: Audit Logging
    await logSecurityEvent({
      user_id: user.id,
      event_type: 'account_deletion_initiated',
      event_data: { email: user.email },
      request,
    })

    // Get profile info for emails
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name, stripe_customer_id')
      .eq('id', user.id)
      .single()

    const userEmail = profile?.email || user.email!
    const userName = profile?.full_name || 'Benutzer'
    const stripeCustomerId = profile?.stripe_customer_id

    // Step 3: Notify Trusted Persons
    try {
      const { data: trustedPersons } = await supabase
        .from('trusted_persons')
        .select('name, email')
        .eq('user_id', user.id)

      if (trustedPersons && trustedPersons.length > 0) {
        await Promise.allSettled(
          trustedPersons.map((tp) =>
            sendTrustedPersonDeletionNotification(tp.email, tp.name, userName)
          )
        )
      }
    } catch (error) {
      console.error('Error notifying trusted persons:', error)
      // Don't block deletion
    }

    // Step 4: Delete storage files
    const serviceClient = createServiceClient()

    // Delete documents from storage
    const { data: documents } = await serviceClient
      .from('documents')
      .select('file_path')
      .eq('user_id', user.id)

    if (documents && documents.length > 0) {
      const filePaths = documents.map((d) => d.file_path).filter(Boolean)
      if (filePaths.length > 0) {
        await serviceClient.storage.from('documents').remove(filePaths)
      }
    }

    // Delete profile picture
    const { data: profileData } = await serviceClient
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', user.id)
      .single()

    if (profileData?.profile_picture_url) {
      const picturePath = profileData.profile_picture_url.split('/').pop()
      if (picturePath) {
        await serviceClient.storage.from('avatars').remove([`${user.id}/${picturePath}`])
      }
    }

    // Step 5: Delete all user data from tables
    await serviceClient.from('documents').delete().eq('user_id', user.id)
    await serviceClient.from('reminders').delete().eq('user_id', user.id)

    // Delete email retry queue entries for user's trusted persons
    const { data: tpIds } = await serviceClient
      .from('trusted_persons')
      .select('id')
      .eq('user_id', user.id)

    if (tpIds && tpIds.length > 0) {
      const ids = tpIds.map((tp) => tp.id)
      await serviceClient.from('email_retry_queue').delete().in('trusted_person_id', ids)
    }

    await serviceClient.from('trusted_persons').delete().eq('user_id', user.id)
    await serviceClient.from('emergency_contacts').delete().eq('user_id', user.id)
    await serviceClient.from('medical_info').delete().eq('user_id', user.id)
    await serviceClient.from('advance_directives').delete().eq('user_id', user.id)
    await serviceClient.from('funeral_wishes').delete().eq('user_id', user.id)
    await serviceClient.from('custom_categories').delete().eq('user_id', user.id)
    await serviceClient.from('subcategories').delete().eq('user_id', user.id)
    await serviceClient.from('consent_ledger').delete().eq('user_id', user.id)
    await serviceClient.from('download_tokens').delete().eq('user_id', user.id)
    await serviceClient.from('onboarding_feedback').delete().eq('user_id', user.id)

    // Delete rate limits associated with user's email
    await serviceClient
      .from('rate_limits')
      .delete()
      .like('identifier', `%${user.email}%`)

    // Delete auth lockouts for user's email
    await serviceClient
      .from('auth_lockouts')
      .delete()
      .eq('email', user.email!)

    // Delete profile last (other tables may reference it)
    await serviceClient.from('profiles').delete().eq('id', user.id)

    // Step 6: PostHog Deletion Request
    try {
      const posthogApiKey = process.env.POSTHOG_API_KEY
      const posthogProjectId = process.env.POSTHOG_PROJECT_ID
      const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com'

      if (posthogApiKey && posthogProjectId) {
        await fetch(
          `${posthogHost}/api/projects/${posthogProjectId}/persons/?distinct_id=${user.id}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${posthogApiKey}`,
            },
          }
        ).then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            if (data.results && data.results.length > 0) {
              const personId = data.results[0].id
              await fetch(
                `${posthogHost}/api/projects/${posthogProjectId}/persons/${personId}/`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${posthogApiKey}`,
                  },
                }
              )
            }
          }
        })

        console.log(
          JSON.stringify({
            event: 'posthog_deletion_requested',
            user_id: user.id,
            timestamp: new Date().toISOString(),
          })
        )
      }
    } catch (error) {
      console.error('PostHog deletion request failed:', error)
      // Don't block account deletion
    }

    // Step 7: Stripe Customer Metadata
    try {
      if (stripeCustomerId) {
        const stripe = getStripe()
        await stripe.customers.update(stripeCustomerId, {
          metadata: {
            account_deleted: 'true',
            deleted_at: new Date().toISOString(),
          },
        })

        console.log(
          JSON.stringify({
            event: 'stripe_customer_marked_deleted',
            stripe_customer_id: stripeCustomerId,
            timestamp: new Date().toISOString(),
          })
        )
      }
    } catch (error) {
      console.error('Stripe metadata update failed:', error)
      // Don't block account deletion
    }

    // Step 8: Delete Auth User
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      console.error('Failed to delete auth user:', deleteUserError)
      // User data is already gone, log but continue
    }

    // Step 9: Send Confirmation Email
    try {
      await sendSecurityNotification('account_deleted', userEmail, {
        userName,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to send deletion confirmation email:', error)
      // Don't fail the deletion if email fails
    }

    // Step 10: Log deletion completed
    await logSecurityEvent({
      user_id: user.id,
      event_type: 'account_deletion_completed',
      event_data: { email: user.email },
      request,
    })

    // Step 11: Sign Out and Return
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'Fehler beim L\u00f6schen des Kontos' },
      { status: 500 }
    )
  }
}
