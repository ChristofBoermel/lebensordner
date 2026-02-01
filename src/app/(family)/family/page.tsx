import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFamilyPermissions } from '@/lib/permissions/family-permissions'
import { Card, CardContent } from '@/components/ui/card'
import { Folder } from 'lucide-react'
import {
  FamilyDocumentsClient,
  DocumentsSkeleton,
} from './family-documents-client'

// Documents list server component
async function DocumentsList({
  userId,
  ownerId,
  ownerName
}: {
  userId: string,
  ownerId: string,
  ownerName: string
}) {
  const supabase = await createServerSupabaseClient()

  // Get permissions (checks subscription tier for download)
  const permissions = await getFamilyPermissions(userId, ownerId)

  // Fetch documents for this owner
  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, title, file_name, file_size, file_type, category, created_at, notes')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })

  if (error || !documents || documents.length === 0) {
    return (
      <Card className="border-warmgray-200">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="h-12 w-12 text-warmgray-300" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-medium text-warmgray-900">
            Keine Dokumente vorhanden
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-[1.6] text-warmgray-500">
            {ownerName} hat noch keine Dokumente hochgeladen oder Sie haben noch keinen Zugriff.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <FamilyDocumentsClient
      documents={documents}
      ownerId={ownerId}
      ownerName={ownerName}
      canDownload={permissions.canDownload}
    />
  )
}

// Main page component
export default async function FamilyPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/anmelden')
  }

  // Get the owner this family member is connected to
  const { data: trustedPerson } = await supabase
    .from('trusted_persons')
    .select('user_id, name')
    .eq('linked_user_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('is_active', true)
    .single()

  if (!trustedPerson) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-warmgray-900">Dokumente</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-6">
            <Folder className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <p className="text-amber-800">
              Keine Verbindung zu einem Familienmitglied gefunden.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="space-y-4 text-center sm:text-left">
        <h1 className="text-4xl font-bold tracking-tight text-warmgray-900 sm:text-5xl">
          Dokumente
        </h1>
        <p className="text-xl leading-[1.6] text-warmgray-700 max-w-2xl mx-auto sm:mx-0">
          Hier finden Sie alle wichtigen Unterlagen von <span className="font-semibold">{trustedPerson.name || 'Ihrem Familienmitglied'}</span>,
          auf die Sie Zugriff haben.
        </p>
      </div>

      <div className="mt-12">
        {/* Documents with Suspense */}
        <Suspense fallback={<DocumentsSkeleton />}>
          <DocumentsList
            userId={user.id}
            ownerId={trustedPerson.user_id}
            ownerName={trustedPerson.name || 'Besitzer'}
          />
        </Suspense>
      </div>
    </div>
  )
}
