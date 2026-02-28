import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

interface DocumentRow {
  category: DocumentCategory
}

interface TrustedPersonRow {
  id: string
}

interface ReminderRow {
  id: string
  title: string
  due_date: string
}

interface ProfileRow {
  full_name: string | null
  onboarding_completed: boolean
  storage_used: number
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/anmelden')
  }

  // Parallel execution of all queries
  const [profile, documents, trustedPersons, reminders] = await Promise.all([
    // Profile query
    supabase
      .from('profiles')
      .select('full_name, onboarding_completed, storage_used')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('[DASHBOARD] Profile query error:', error.code, error.message, error.details, error.hint)
        }
        return data as ProfileRow | null
      }),

    // Documents query
    supabase
      .from('documents')
      .select('category')
      .eq('user_id', user.id)
      .then(({ data }) => data as DocumentRow[] | null),

    // Trusted persons query
    supabase
      .from('trusted_persons')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .then(({ data }) => data as TrustedPersonRow[] | null),

    // Reminders query
    supabase
      .from('reminders')
      .select('id, title, due_date')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .order('due_date', { ascending: true })
      .limit(3)
      .then(({ data }) => data as ReminderRow[] | null),
  ])

  // Redirect to onboarding if no profile or not completed
  if (!profile || !profile.onboarding_completed) {
    redirect('/onboarding')
  }

  return (
    <DashboardContent
      profile={profile}
      documents={documents || []}
      trustedPersons={trustedPersons || []}
      reminders={reminders || []}
    />
  )
}
