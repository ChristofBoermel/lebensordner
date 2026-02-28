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
    process.env['SUPABASE_URL']!,
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

    // Step 4: Fetch storage file paths (must happen before RPC deletes the DB rows)
    const serviceClient = createServiceClient()

    const { data: documents } = await serviceClient
      .from('documents')
      .select('file_path')
      .eq('user_id', user.id)

    const filePaths = (documents || []).map((d) => d.file_path).filter(Boolean)

    const { data: profileData } = await serviceClient
      .from('profiles')
      .select('profile_picture_url')
      .eq('id', user.id)
      .single()

    const avatarPath = profileData?.profile_picture_url
      ? profileData.profile_picture_url.split('/').pop()
      : null

    // Step 5a: Delete DB data (must succeed before external cleanup)
    const { error: rpcError } = await serviceClient.rpc('delete_user_account', { p_user_id: user.id, p_email: user.email! })
    if (rpcError) throw rpcError

    // Step 5b: Best-effort external cleanup
    await Promise.all([
      // a. Delete storage files
      (async () => {
        try {
          if (filePaths.length > 0) {
            await serviceClient.storage.from('documents').remove(filePaths)
          }
          if (avatarPath) {
            await serviceClient.storage.from('avatars').remove([`${user.id}/${avatarPath}`])
          }
        } catch (error) {
          console.error('Storage cleanup failed:', error)
          // Don't block account deletion
        }
      })(),

      // b. PostHog deletion request
      (async () => {
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
      })(),

      // c. Stripe customer metadata
      (async () => {
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
      })(),
    ])

    // Step 6: Delete Auth User
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      console.error('Failed to delete auth user:', deleteUserError)
      // User data is already gone, log but continue
    }

    // Step 7: Send Confirmation Email
    try {
      await sendSecurityNotification('account_deleted', userEmail, {
        userName,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to send deletion confirmation email:', error)
      // Don't fail the deletion if email fails
    }

    // Step 8: Log deletion completed
    await logSecurityEvent({
      user_id: user.id,
      event_type: 'account_deletion_completed',
      event_data: { email: user.email },
      request,
    })

    // Step 9: Sign Out and Return
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
