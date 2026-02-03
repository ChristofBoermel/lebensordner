import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/layout/dashboard-nav'
import { getUserTier } from '@/lib/auth/tier-guard'

// Wrapper to stream tier data
async function NavWithTier({ user }: { user: any }) {
  const supabase = await createServerSupabaseClient()

  // Fetch tier and profile in parallel for speed
  const [tier, { data: profile }] = await Promise.all([
    getUserTier(),
    supabase.from('profiles').select('full_name, role, profile_picture_url').eq('id', user.id).single()
  ])

  return (
    <DashboardNav
      user={{
        email: user.email || '',
        full_name: profile?.full_name,
        role: profile?.role,
        profile_picture_url: profile?.profile_picture_url
      }}
      tier={tier}
    />
  )
}

function NavSkeleton() {
  return (
    <>
      {/* Desktop Skeleton */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-warmgray-200 bg-white dark:bg-warmgray-900">
        <div className="h-20 flex items-center px-6 border-b border-warmgray-200 dark:border-warmgray-800">
          <div className="h-8 w-8 rounded-lg mr-2 animate-pulse bg-warmgray-200 dark:bg-warmgray-800" />
          <div className="h-6 w-32 rounded animate-pulse bg-warmgray-200 dark:bg-warmgray-800" />
        </div>
        <div className="p-4 space-y-4">
          <div className="h-10 w-full rounded animate-pulse bg-warmgray-200 dark:bg-warmgray-800" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 w-full rounded animate-pulse bg-warmgray-200 dark:bg-warmgray-800" />)}
          </div>
        </div>
      </div>

      {/* Mobile Header Skeleton */}
      <div className="lg:hidden sticky top-0 z-40 flex h-20 items-center justify-between border-b border-warmgray-200 bg-white dark:bg-warmgray-900 px-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-md animate-pulse bg-warmgray-200 dark:bg-warmgray-800" /> {/* Menu Trigger */}
          <div className="ml-2 w-32 h-6 rounded animate-pulse bg-warmgray-200 dark:bg-warmgray-800" /> {/* Logo Text */}
        </div>
        <div className="w-10 h-10 rounded-full animate-pulse bg-warmgray-200 dark:bg-warmgray-800" /> {/* Avatar */}
      </div>
    </>
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/anmelden')
  }

  // Note: Profile and Tier fetching is now handled in NavWithTier to avoid blocking the initial shell render

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-warmgray-950">
      <Suspense fallback={<NavSkeleton />}>
        <NavWithTier user={user} />
      </Suspense>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
