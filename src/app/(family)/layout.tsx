import React from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/permissions/family-permissions'
import { Button } from '@/components/ui/button'
import { LogOut, Users } from 'lucide-react'

interface FamilyLayoutProps {
  children: React.ReactNode
}

async function FamilyNav() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  // Get the owner info for the family member
  const { data: trustedPerson } = await supabase
    .from('trusted_persons')
    .select('user_id')
    .eq('linked_user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .single()
  
  // Get owner's profile
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', trustedPerson?.user_id || '')
    .single()
  
  const ownerName = ownerProfile?.full_name || ownerProfile?.email || 'Ihr Familienmitglied'
  
  return (
    <header className="sticky top-0 z-40 w-full border-b border-warmgray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo & Context */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100">
            <Users className="h-5 w-5 text-sage-700" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-warmgray-900">
              Familienzugriff
            </span>
            <span className="text-xs text-warmgray-500">
              {ownerName}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <form action="/auth/signout" method="POST">
          <Button 
            type="submit"
            variant="outline" 
            size="lg"
            className="h-11 min-h-[44px] px-4 text-sm font-medium"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Abmelden
          </Button>
        </form>
      </div>
    </header>
  )
}

export default async function FamilyLayout({ children }: FamilyLayoutProps) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/anmelden')
  }
  
  // Check if user is an owner - redirect to dashboard
  const userIsOwner = await isOwner(user.id)
  if (userIsOwner) {
    redirect('/dashboard')
  }
  
  // Check if user has any valid family relationship
  const { data: trustedPersons } = await supabase
    .from('trusted_persons')
    .select('id')
    .eq('linked_user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .limit(1)
  
  if (!trustedPersons || trustedPersons.length === 0) {
    // User is not a family member and not an owner - sign out
    redirect('/anmelden?error=no_access')
  }
  
  return (
    <div className="min-h-screen bg-cream-50">
      <FamilyNav />
      
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  )
}
