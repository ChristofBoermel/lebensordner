import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PolicyUpdateClient } from './policy-update-client'

export const metadata = {
  title: 'Datenschutzerklärung aktualisiert',
}

interface PolicyUpdatePageProps {
  searchParams?: {
    returnTo?: string
    next?: string
  }
}

const normalizeReturnTo = (value?: string) => {
  if (!value) return null
  if (value.startsWith('/')) return value
  return null
}

export default async function PolicyUpdatePage({ searchParams }: PolicyUpdatePageProps) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/anmelden')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single() as { data: { onboarding_completed: boolean } | null }

  const returnTo = normalizeReturnTo(searchParams?.returnTo ?? searchParams?.next)

  return (
    <PolicyUpdateClient
      returnTo={returnTo}
      onboardingCompleted={profile?.onboarding_completed ?? false}
    />
  )
}
