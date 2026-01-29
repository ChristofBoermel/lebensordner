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

  // Get user profile and check onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, onboarding_completed, storage_used')
    .eq('id', user.id)
    .single() as { data: ProfileRow | null }

  // Redirect to onboarding if no profile or not completed
  if (!profile || !profile.onboarding_completed) {
    redirect('/onboarding')
  }

  // Get document counts by category
  const { data: documents } = await supabase
    .from('documents')
    .select('category')
    .eq('user_id', user.id) as { data: DocumentRow[] | null }

  // Get trusted persons count
  const { data: trustedPersons } = await supabase
    .from('trusted_persons')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true) as { data: TrustedPersonRow[] | null }

  // Get upcoming reminders (only top 3)
  const { data: reminders } = await supabase
    .from('reminders')
    .select('id, title, due_date')
    .eq('user_id', user.id)
    .eq('is_completed', false)
    .order('due_date', { ascending: true })
    .limit(3) as { data: ReminderRow[] | null }

  return (
    <DashboardContent
      profile={profile}
      documents={documents || []}
      trustedPersons={trustedPersons || []}
      reminders={reminders || []}
    />
  )
}
