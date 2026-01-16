import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  FileText, 
  Upload, 
  Users, 
  Printer,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Calendar
} from 'lucide-react'
import Link from 'next/link'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'

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
    return null
  }

  // Get user profile and check onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, onboarding_completed, storage_used')
    .eq('id', user.id)
    .single() as { data: ProfileRow | null }

  // Redirect to onboarding if not completed
  if (profile && !profile.onboarding_completed) {
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

  // Get upcoming reminders
  const { data: reminders } = await supabase
    .from('reminders')
    .select('id, title, due_date')
    .eq('user_id', user.id)
    .eq('is_completed', false)
    .order('due_date', { ascending: true })
    .limit(5) as { data: ReminderRow[] | null }

  // Calculate organization status
  const totalCategories = Object.keys(DOCUMENT_CATEGORIES).length
  const categoriesWithDocs = new Set(documents?.map(d => d.category) || []).size
  const hasTrustedPersons = (trustedPersons?.length || 0) > 0
  
  let completionPercentage = 0
  completionPercentage += (categoriesWithDocs / totalCategories) * 60 // 60% for documents
  completionPercentage += hasTrustedPersons ? 20 : 0 // 20% for trusted persons
  completionPercentage += profile?.onboarding_completed ? 20 : 0 // 20% for profile completion
  completionPercentage = Math.round(completionPercentage)

  const getStatusInfo = () => {
    if (completionPercentage >= 80) {
      return {
        label: 'Gut organisiert',
        color: 'text-sage-600',
        bgColor: 'bg-sage-50',
        borderColor: 'border-sage-200',
        icon: CheckCircle2,
      }
    } else if (completionPercentage >= 40) {
      return {
        label: 'In Bearbeitung',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: Clock,
      }
    } else {
      return {
        label: 'Handlungsbedarf',
        color: 'text-warmgray-600',
        bgColor: 'bg-warmgray-50',
        borderColor: 'border-warmgray-200',
        icon: AlertCircle,
      }
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Willkommen{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Hier sehen Sie den aktuellen Stand Ihres Lebensordners.
        </p>
      </div>

      {/* Organization Status Card */}
      <Card className={`${statusInfo.borderColor} border-2`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Organisations-Status</CardTitle>
              <CardDescription className="mt-1">
                Wie gut sind Ihre wichtigen Lebensinformationen aktuell organisiert?
              </CardDescription>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
              <StatusIcon className="w-5 h-5" />
              <span className="font-medium">{statusInfo.label}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-warmgray-600">Fortschritt</span>
              <span className="font-medium text-warmgray-900">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoriesWithDocs > 0 ? 'bg-sage-100' : 'bg-warmgray-100'}`}>
                  <FileText className={`w-5 h-5 ${categoriesWithDocs > 0 ? 'text-sage-600' : 'text-warmgray-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-warmgray-900">
                    {categoriesWithDocs} von {totalCategories} Kategorien
                  </p>
                  <p className="text-xs text-warmgray-500">mit Dokumenten</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasTrustedPersons ? 'bg-sage-100' : 'bg-warmgray-100'}`}>
                  <Users className={`w-5 h-5 ${hasTrustedPersons ? 'text-sage-600' : 'text-warmgray-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-warmgray-900">
                    {trustedPersons?.length || 0} Vertrauensperson{(trustedPersons?.length || 0) !== 1 ? 'en' : ''}
                  </p>
                  <p className="text-xs text-warmgray-500">hinterlegt</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profile?.onboarding_completed ? 'bg-sage-100' : 'bg-warmgray-100'}`}>
                  <CheckCircle2 className={`w-5 h-5 ${profile?.onboarding_completed ? 'text-sage-600' : 'text-warmgray-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-warmgray-900">
                    {profile?.onboarding_completed ? 'Profil vollständig' : 'Profil unvollständig'}
                  </p>
                  <p className="text-xs text-warmgray-500">persönliche Daten</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Schnellaktionen</CardTitle>
              <CardDescription>Die wichtigsten Aktionen auf einen Blick</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/dokumente?upload=true">
                  <div className="category-card text-center cursor-pointer">
                    <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-6 h-6 text-sage-600" />
                    </div>
                    <p className="font-medium text-warmgray-900">Dokument hochladen</p>
                  </div>
                </Link>
                
                <Link href="/zugriff?add=true">
                  <div className="category-card text-center cursor-pointer">
                    <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-sage-600" />
                    </div>
                    <p className="font-medium text-warmgray-900">Person hinzufügen</p>
                  </div>
                </Link>
                
                <Link href="/export">
                  <div className="category-card text-center cursor-pointer">
                    <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center mx-auto mb-3">
                      <Printer className="w-6 h-6 text-sage-600" />
                    </div>
                    <p className="font-medium text-warmgray-900">Übersicht drucken</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reminders */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Erinnerungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reminders && reminders.length > 0 ? (
                <ul className="space-y-3">
                  {reminders.map((reminder) => (
                    <li key={reminder.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-warmgray-900">{reminder.title}</p>
                        <p className="text-xs text-warmgray-500">
                          {new Date(reminder.due_date).toLocaleDateString('de-DE', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-warmgray-500 text-center py-4">
                  Keine anstehenden Erinnerungen
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Document Categories Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ihre Dokumenten-Kategorien</CardTitle>
              <CardDescription>Klicken Sie auf eine Kategorie, um Dokumente zu verwalten</CardDescription>
            </div>
            <Link href="/dokumente">
              <Button variant="ghost" size="sm">
                Alle anzeigen
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => {
              const docCount = documents?.filter(d => d.category === key).length || 0
              return (
                <Link key={key} href={`/dokumente?kategorie=${key}`}>
                  <div className="text-center p-4 rounded-lg border border-warmgray-200 hover:border-sage-300 hover:bg-sage-50 transition-colors cursor-pointer">
                    <p className="text-xs font-medium text-warmgray-900 mb-1">{category.name}</p>
                    <p className="text-lg font-semibold text-sage-600">{docCount}</p>
                    <p className="text-xs text-warmgray-500">Dokument{docCount !== 1 ? 'e' : ''}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
