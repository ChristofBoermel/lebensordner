'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  Plus,
  Bell,
  Clock,
  CheckCircle2,
  FileText,
  HeartPulse,
  Trash2,
  Edit2,
  Loader2,
  AlertTriangle,
  Users,
  RotateCcw,
  ArrowRight,
  History,
  Upload,
  ChevronRight,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { getTierFromSubscription, SUBSCRIPTION_TIERS, type TierConfig } from '@/lib/subscription-tiers'
import Link from 'next/link'

interface Reminder {
  id: string
  title: string
  description: string | null
  due_date: string
  is_completed: boolean
  reminder_type: 'document_expiry' | 'annual_review' | 'checkup' | 'custom'
  recurrence: 'none' | 'yearly' | 'half_yearly' | 'quarterly' | null
  document_id: string | null
  document_category: string | null
  reminder_watcher_id: string | null
  created_at: string
}

interface FamilyMember {
  id: string
  name: string
  email: string
}

const REMINDER_TYPES = {
  document_expiry: {
    name: 'Dokument-Ablauf',
    description: 'Erinnerung für ablaufende Dokumente',
    icon: FileText,
    color: 'text-amber-600 bg-amber-50',
  },
  checkup: {
    name: 'Vorsorge / Checkup',
    description: 'Medizinische Termine oder Prüfungen',
    icon: HeartPulse,
    color: 'text-red-600 bg-red-50',
  },
  annual_review: {
    name: 'Jährliche Prüfung',
    description: 'Regelmäßige Überprüfung Ihrer Unterlagen',
    icon: Calendar,
    color: 'text-blue-600 bg-blue-50',
  },
  custom: {
    name: 'Eigene Erinnerung',
    description: 'Individuelle Erinnerung',
    icon: Bell,
    color: 'text-sage-600 bg-sage-50',
  },
}

const RECURRENCE_LABELS = {
  none: 'Einmalig',
  yearly: 'Jährlich',
  half_yearly: 'Halbjährlich',
  quarterly: 'Vierteljährlich',
}

export default function ErinnerungenPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)

  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    reminder_type: 'custom' as Reminder['reminder_type'],
    recurrence: 'none' as Reminder['recurrence'],
    reminder_watcher_id: null as string | null,
  })

  // Family members for reminder watcher
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])

  const supabase = createClient()
  const canUseWatcher = useMemo(() => userTier.limits.familyDashboard, [userTier])

  useEffect(() => {
    async function fetchTier() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, stripe_price_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        const tier = getTierFromSubscription(profile.subscription_status, profile.stripe_price_id)
        setUserTier(tier)
      }
    }
    fetchTier()
  }, [supabase])

  const fetchReminders = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setIsLoading(false)
      setError('Sitzung abgelaufen. Bitte melden Sie sich erneut an.')
      return
    }

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true }) as { data: Reminder[] | null, error: Error | null }

    if (!error && data) {
      setReminders(data)
    }
    setIsLoading(false)
  }, [supabase])

  const fetchFamilyMembers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get trusted persons that are linked (have user accounts and accepted invitations)
    const { data: trustedPersons } = await supabase
      .from('trusted_persons')
      .select('id, name, email, linked_user_id')
      .eq('user_id', user.id)
      .not('linked_user_id', 'is', null)

    if (trustedPersons) {
      setFamilyMembers(trustedPersons.map(tp => ({
        id: tp.id,
        name: tp.name,
        email: tp.email
      })))
    }
  }, [supabase])

  useEffect(() => {
    fetchReminders()
    if (canUseWatcher) {
      fetchFamilyMembers()
    }
  }, [fetchReminders, fetchFamilyMembers, canUseWatcher])

  const handleOpenDialog = (reminder?: Reminder) => {
    if (reminder) {
      setEditingReminder(reminder)
      setForm({
        title: reminder.title,
        description: reminder.description || '',
        due_date: reminder.due_date,
        reminder_type: reminder.reminder_type,
        recurrence: reminder.recurrence || 'none',
        reminder_watcher_id: reminder.reminder_watcher_id || null,
      })
    } else {
      setEditingReminder(null)
      // Default to 30 days from now
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 30)
      setForm({
        title: '',
        description: '',
        due_date: defaultDate.toISOString().split('T')[0],
        reminder_type: 'custom',
        recurrence: 'none',
        reminder_watcher_id: null,
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.title || !form.due_date) {
      setError('Bitte füllen Sie alle Pflichtfelder aus.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      const watcherId = canUseWatcher ? form.reminder_watcher_id : null
      const isNewWatcher = watcherId &&
        (!editingReminder || editingReminder.reminder_watcher_id !== watcherId)

      if (editingReminder) {
        const { error } = await supabase
          .from('reminders')
          .update({
            title: form.title,
            description: form.description || null,
            due_date: form.due_date,
            reminder_type: form.reminder_type,
            recurrence: form.recurrence !== 'none' ? form.recurrence : null,
            reminder_watcher_id: watcherId,
          })
          .eq('id', editingReminder.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reminders')
          .insert({
            user_id: user.id,
            title: form.title,
            description: form.description || null,
            due_date: form.due_date,
            reminder_type: form.reminder_type,
            recurrence: form.recurrence !== 'none' ? form.recurrence : null,
            reminder_watcher_id: watcherId,
          })

        if (error) throw error
      }

      // Send notification to new watcher
      if (isNewWatcher) {
        const watcher = familyMembers.find(m => m.id === watcherId)
        if (watcher) {
          try {
            await fetch('/api/reminder-watcher/notify-reminder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reminderTitle: form.title,
                reminderDescription: form.description,
                dueDate: form.due_date,
                watcherEmail: watcher.email,
                watcherName: watcher.name,
              })
            })
          } catch (err) {
            console.error('Failed to notify watcher:', err)
          }
        }
      }

      setIsDialogOpen(false)
      fetchReminders()
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleComplete = async (reminder: Reminder) => {
    try {
      const isCompleting = !reminder.is_completed
      
      // If it's a recurring reminder and we're marking it as complete,
      // create the next occurrence
      if (isCompleting && reminder.recurrence && reminder.recurrence !== 'none') {
        const nextDueDate = new Date(reminder.due_date)
        if (reminder.recurrence === 'yearly') nextDueDate.setFullYear(nextDueDate.getFullYear() + 1)
        if (reminder.recurrence === 'half_yearly') nextDueDate.setMonth(nextDueDate.getMonth() + 6)
        if (reminder.recurrence === 'quarterly') nextDueDate.setMonth(nextDueDate.getMonth() + 3)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('reminders')
            .insert({
              user_id: user.id,
              title: reminder.title,
              description: reminder.description,
              due_date: nextDueDate.toISOString().split('T')[0],
              reminder_type: reminder.reminder_type,
              recurrence: reminder.recurrence,
              reminder_watcher_id: reminder.reminder_watcher_id,
              document_id: reminder.document_id,
              document_category: reminder.document_category,
            })
        }
      }

      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: isCompleting })
        .eq('id', reminder.id)

      if (error) throw error
      fetchReminders()
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const handleSnooze = async (reminder: Reminder, unit: 'week' | 'month') => {
    try {
      const newDate = new Date(reminder.due_date)
      if (unit === 'week') newDate.setDate(newDate.getDate() + 7)
      if (unit === 'month') newDate.setMonth(newDate.getMonth() + 1)

      const { error } = await supabase
        .from('reminders')
        .update({ due_date: newDate.toISOString().split('T')[0] })
        .eq('id', reminder.id)

      if (error) throw error
      fetchReminders()
    } catch (err) {
      console.error('Snooze error:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Erinnerung wirklich löschen?')) return

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchReminders()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const getDaysUntil = (dateString: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(dateString)
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getUrgencyClass = (dateString: string, isCompleted: boolean) => {
    if (isCompleted) return 'border-warmgray-200 bg-warmgray-50'
    const days = getDaysUntil(dateString)
    if (days < 0) return 'border-red-300 bg-red-50'
    if (days <= 7) return 'border-amber-300 bg-amber-50'
    if (days <= 30) return 'border-sage-300 bg-sage-50'
    return 'border-warmgray-200 bg-white'
  }

  const pendingReminders = reminders.filter(r => !r.is_completed)
  const completedReminders = reminders.filter(r => r.is_completed)
  const overdueReminders = pendingReminders.filter(r => getDaysUntil(r.due_date) < 0)
  const upcomingReminders = pendingReminders.filter(r => getDaysUntil(r.due_date) >= 0 && getDaysUntil(r.due_date) <= 30)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-0 overflow-x-hidden">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Erinnerungen & Fristen
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Behalten Sie wichtige Termine und Fristen im Blick
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(overdueReminders.length > 0 ? 'border-red-300 shadow-sm' : '', "senior-mode:p-2")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center senior-mode:w-16 senior-mode:h-16 ${overdueReminders.length > 0 ? 'bg-red-100' : 'bg-warmgray-100'}`}>
                <AlertTriangle className={`w-6 h-6 senior-mode:w-8 senior-mode:h-8 ${overdueReminders.length > 0 ? 'text-red-600' : 'text-warmgray-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-warmgray-900 senior-mode:text-3xl">{overdueReminders.length}</p>
                <p className="text-sm text-warmgray-500 senior-mode:text-lg">Überfällig</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="senior-mode:p-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center senior-mode:w-16 senior-mode:h-16">
                <Clock className="w-6 h-6 text-amber-600 senior-mode:w-8 senior-mode:h-8" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-warmgray-900 senior-mode:text-3xl">{upcomingReminders.length}</p>
                <p className="text-sm text-warmgray-500 senior-mode:text-lg">In 30 Tagen fällig</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="senior-mode:p-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sage-100 flex items-center justify-center senior-mode:w-16 senior-mode:h-16">
                <CheckCircle2 className="w-6 h-6 text-sage-600 senior-mode:w-8 senior-mode:h-8" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-warmgray-900 senior-mode:text-3xl">{completedReminders.length}</p>
                <p className="text-sm text-warmgray-500 senior-mode:text-lg">Erledigt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()} className="senior-mode:h-16 senior-mode:px-8 senior-mode:text-xl shadow-md">
          <Plus className="w-5 h-5 mr-2" />
          Neue Erinnerung
        </Button>
      </div>

      {/* Reminders List */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1 senior-mode:h-16">
          <TabsTrigger value="pending" className="senior-mode:text-xl py-3 sm:py-2">
            Offen ({pendingReminders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="senior-mode:text-xl py-3 sm:py-2">
            Erledigt ({completedReminders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingReminders.length > 0 ? (
            <div className="space-y-4">
              {pendingReminders.map((reminder) => {
                const typeInfo = REMINDER_TYPES[reminder.reminder_type] || REMINDER_TYPES.custom
                const TypeIcon = typeInfo.icon
                const daysUntil = getDaysUntil(reminder.due_date)
                
                return (
                  <div 
                    key={reminder.id}
                    className={`flex flex-col p-4 rounded-xl border-2 transition-all duration-300 senior-mode:p-6 ${getUrgencyClass(reminder.due_date, reminder.is_completed)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <button
                          onClick={() => handleToggleComplete(reminder)}
                          className="w-8 h-8 rounded-full border-2 border-warmgray-300 hover:border-sage-500 hover:bg-sage-50 transition-colors flex-shrink-0 mt-1 senior-mode:w-10 senior-mode:h-10"
                          title="Als erledigt markieren"
                        />
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 senior-mode:w-14 senior-mode:h-14 ${typeInfo.color}`}>
                          <TypeIcon className="w-6 h-6 senior-mode:w-8 senior-mode:h-8" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-lg text-warmgray-900 senior-mode:text-2xl leading-tight mb-1">{reminder.title}</p>
                          {reminder.description && (
                            <p className="text-sm text-warmgray-600 senior-mode:text-lg mb-2 line-clamp-2">{reminder.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5 text-sm text-warmgray-500 senior-mode:text-lg">
                              <Calendar className="w-4 h-4 senior-mode:w-5 senior-mode:h-5" />
                              <span suppressHydrationWarning>{formatDate(reminder.due_date)}</span>
                            </div>
                            
                            {reminder.recurrence && reminder.recurrence !== 'none' && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium senior-mode:text-base senior-mode:px-3">
                                <RotateCcw className="w-3 h-3 senior-mode:w-4 senior-mode:h-4" />
                                {RECURRENCE_LABELS[reminder.recurrence]}
                              </div>
                            )}

                            {daysUntil < 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-tight senior-mode:text-base senior-mode:px-3">
                                Überfällig
                              </span>
                            )}
                            {daysUntil === 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-tight senior-mode:text-base senior-mode:px-3">
                                Heute fällig
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 flex-shrink-0 items-end print:hidden">
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleOpenDialog(reminder)}
                            className="h-10 w-10 senior-mode:h-12 senior-mode:w-12"
                          >
                            <Edit2 className="w-4 h-4 senior-mode:w-6 senior-mode:h-6" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(reminder.id)}
                            className="text-red-600 hover:bg-red-50 h-10 w-10 senior-mode:h-12 senior-mode:w-12"
                          >
                            <Trash2 className="w-4 h-4 senior-mode:w-6 senior-mode:h-6" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar for Pending Reminders */}
                    <div className="mt-4 pt-4 border-t border-warmgray-100 flex flex-wrap items-center gap-2 senior-mode:mt-6 senior-mode:pt-6">
                      <p className="text-xs font-bold text-warmgray-400 uppercase tracking-widest mr-2 w-full sm:w-auto senior-mode:text-base senior-mode:mb-2 sm:senior-mode:mb-0">Aktionen:</p>
                      
                      {/* Snooze Buttons */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSnooze(reminder, 'week')}
                        className="h-9 text-xs senior-mode:h-12 senior-mode:text-lg senior-mode:px-4"
                      >
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        +1 Woche
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSnooze(reminder, 'month')}
                        className="h-9 text-xs senior-mode:h-12 senior-mode:text-lg senior-mode:px-4"
                      >
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        +1 Monat
                      </Button>

                      {/* Quick Renew for document expiry */}
                      {reminder.reminder_type === 'document_expiry' && (
                        <Button 
                          asChild
                          size="sm" 
                          className="h-9 text-xs senior-mode:h-12 senior-mode:text-lg senior-mode:px-4 bg-amber-600 hover:bg-amber-700"
                        >
                          <Link href={`/dokumente?upload=true&kategorie=${reminder.document_category || 'identitaet'}`}>
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Neu hochladen
                          </Link>
                        </Button>
                      )}

                      {/* Quick Renew for Annual Review */}
                      {reminder.reminder_type === 'annual_review' && (
                        <Button 
                          asChild
                          variant="secondary"
                          size="sm" 
                          className="h-9 text-xs senior-mode:h-12 senior-mode:text-lg senior-mode:px-4"
                        >
                          <Link href="/dokumente">
                            <History className="w-3.5 h-3.5 mr-1.5" />
                            Zum Tresor
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card className="senior-mode:p-4">
              <CardContent className="py-12 text-center">
                <Bell className="w-16 h-16 text-warmgray-200 mx-auto mb-4 senior-mode:w-24 senior-mode:h-24" />
                <h3 className="text-xl font-medium text-warmgray-900 mb-2 senior-mode:text-2xl">
                  Keine offenen Erinnerungen
                </h3>
                <p className="text-warmgray-500 mb-6 senior-mode:text-xl">
                  Erstellen Sie Erinnerungen für wichtige Fristen, Checkups oder Termine.
                </p>
                <Button onClick={() => handleOpenDialog()} size="lg" className="senior-mode:h-16 senior-mode:px-8 senior-mode:text-xl">
                  <Plus className="w-5 h-5 mr-2" />
                  Erste Erinnerung erstellen
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedReminders.length > 0 ? (
            <div className="space-y-3">
              {completedReminders.map((reminder) => {
                const typeInfo = REMINDER_TYPES[reminder.reminder_type] || REMINDER_TYPES.custom
                const TypeIcon = typeInfo.icon
                
                return (
                  <div 
                    key={reminder.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-warmgray-200 bg-warmgray-50 opacity-70 gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <button
                        onClick={() => handleToggleComplete(reminder)}
                        className="w-8 h-8 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0 senior-mode:w-10 senior-mode:h-10"
                        title="Wieder öffnen"
                      >
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-warmgray-200 flex items-center justify-center flex-shrink-0 senior-mode:w-12 senior-mode:h-12">
                        <TypeIcon className="w-5 h-5 text-warmgray-500 senior-mode:w-7 senior-mode:h-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-warmgray-700 line-through senior-mode:text-xl truncate">{reminder.title}</p>
                        <p className="text-sm text-warmgray-500 senior-mode:text-lg" suppressHydrationWarning>
                          Erledigt am {formatDate(reminder.created_at)} (Fällig war {formatDate(reminder.due_date)})
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(reminder.id)}
                      className="text-red-600 hover:bg-red-50 h-10 w-10 senior-mode:h-12 senior-mode:w-12 self-end sm:self-auto"
                    >
                      <Trash2 className="w-4 h-4 senior-mode:w-6 senior-mode:h-6" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card className="senior-mode:p-4">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-warmgray-200 mx-auto mb-4 senior-mode:w-24 senior-mode:h-24" />
                <p className="text-warmgray-500 senior-mode:text-xl">
                  Noch keine erledigten Erinnerungen
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="senior-mode:text-2xl">
              {editingReminder ? 'Erinnerung bearbeiten' : 'Neue Erinnerung'}
            </DialogTitle>
            <DialogDescription className="senior-mode:text-lg">
              Erstellen Sie eine Erinnerung für wichtige Fristen, Checkups oder Termine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm senior-mode:text-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title" className="senior-mode:text-lg">Titel *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="z.B. Personalausweis erneuern"
                className="senior-mode:h-12 senior-mode:text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="senior-mode:text-lg">Beschreibung (optional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Weitere Details..."
                className="senior-mode:h-12 senior-mode:text-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date" className="senior-mode:text-lg">Fälligkeitsdatum *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="senior-mode:h-12 senior-mode:text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurrence" className="senior-mode:text-lg">Wiederholung</Label>
                <select
                  id="recurrence"
                  value={form.recurrence ?? 'none'}
                  onChange={(e) => setForm({ ...form, recurrence: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 senior-mode:h-12 senior-mode:text-lg"
                >
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="senior-mode:text-lg">Art der Erinnerung</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(REMINDER_TYPES).map(([key, type]) => {
                  const Icon = type.icon
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all senior-mode:p-4 ${
                        form.reminder_type === key
                          ? 'border-sage-500 bg-sage-50 ring-2 ring-sage-100'
                          : 'border-warmgray-200 hover:border-warmgray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reminder_type"
                        value={key}
                        checked={form.reminder_type === key}
                        onChange={() => setForm({ ...form, reminder_type: key as Reminder['reminder_type'] })}
                        className="sr-only"
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 senior-mode:w-12 senior-mode:h-12 ${type.color}`}>
                        <Icon className="w-5 h-5 senior-mode:w-7 senior-mode:h-7" />
                      </div>
                      <span className="text-sm font-semibold senior-mode:text-lg leading-tight">{type.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <Separator />

            {!canUseWatcher && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-warmgray-500 senior-mode:text-lg">
                  <Users className="w-4 h-4 senior-mode:w-5 senior-mode:h-5" />
                  Weitere Person benachrichtigen
                </Label>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-800 senior-mode:text-lg leading-relaxed">
                    <strong>Hinweis:</strong> Upgraden Sie auf den <strong>Basis+</strong> oder <strong>Premium</strong> Tarif, um Vertrauenspersonen automatisch zu benachrichtigen.
                  </p>
                  <Link href="/abo" className="text-xs text-amber-700 underline font-bold mt-2 inline-block senior-mode:text-base">
                    Tarife ansehen
                  </Link>
                </div>
              </div>
            )}

            {/* Reminder Watcher - only show if family members exist */}
            {canUseWatcher && familyMembers.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 senior-mode:text-lg">
                  <Users className="w-4 h-4 senior-mode:w-5 senior-mode:h-5" />
                  Wer soll diesen Termin zusätzlich im Blick haben?
                </Label>
                <select
                  value={form.reminder_watcher_id || '_none'}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm({ ...form, reminder_watcher_id: value === '_none' ? null : value })
                  }}
                  className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 senior-mode:h-12 senior-mode:text-lg"
                >
                  <option value="_none">Nur ich persönlich</option>
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-warmgray-500 senior-mode:text-base mt-1">
                  Die gewählte Person erhält eine Bestätigung und wird 30 Tage vor Fälligkeit ebenfalls erinnert.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="w-full sm:w-auto senior-mode:h-14 senior-mode:text-xl"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full sm:w-auto senior-mode:h-14 senior-mode:text-xl shadow-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Erinnerung speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
