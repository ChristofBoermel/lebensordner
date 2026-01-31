import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { LayoutDashboard, LogOut, Leaf, Eye, Type, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

async function FamilyNav({ user }: { user: any }) {
  return (
    <nav className="border-b border-warmgray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl flex items-center justify-between">
        <Link href="/family" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-semibold text-warmgray-900">Lebensordner</span>
          <span className="ml-2 rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-800">
            Familien-Zugriff
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Simple logout for family members */}
          <form action="/auth/sign-out" method="post">
            <Button variant="ghost" size="lg" className="h-12 text-red-600 hover:bg-red-50 hover:text-red-700">
              <LogOut className="mr-2 h-5 w-5" />
              Abmelden
            </Button>
          </form>
        </div>
      </div>
    </nav>
  )
}

export default async function FamilyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/anmelden')
  }

  // Check role: Redirect Owners to /vault
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'family_member') {
    redirect('/dashboard') // Owners go to dashboard
  }

  return (
    <div className="min-h-screen bg-cream-50 font-sans antialiased text-warmgray-900 selection:bg-sage-100 selection:text-sage-900">
      <FamilyNav user={user} />
      <main className="mx-auto max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {children}
        </div>
      </main>
    </div>
  )
}
