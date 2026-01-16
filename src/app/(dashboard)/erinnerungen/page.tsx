'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Trash2,
  Edit2,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Reminder {
  id: string
  title: string
  description: string | null
  due_date: string
  is_completed: boolean
  reminder_type: 'document_expiry' | 'annual_review' | 'custom'
  document_id: string | null
  created_at: string
}

const REMINDER_TYPES = {
  document_expiry: {
    name: 'Dokument-Ablauf',
    description: 'Erinnerung für ablaufende Dokumente',
    icon: FileText,
    color: 'text-amber-600 bg-amber-50',
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

export default function ErinnerungenPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    reminder_type: 'custom' as Reminder['reminder_type'],
  })

  const supabase = createClient()

  const fetchReminders = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

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

  useEffect(() => {
    fetchReminders()
  }, [fetchReminders])

  const handleOpenDialog = (reminder?: Reminder) => {
    if (reminder) {
      setEditingReminder(reminder)
      setForm({
        title: reminder.title,
        description: reminder.description || '',
        due_date: reminder.due_date,
        reminder_type: reminder.reminder_type,
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

      if (editingReminder) {
        const { error } = await supabase
          .from('reminders')
          .update({
            title: form.title,
            description: form.description || null,
            due_date: form.due_date,
            reminder_type: form.reminder_type,
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
          })

        if (error) throw error
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
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: !reminder.is_completed })
        .eq('id', reminder.id)

      if (error) throw error
      fetchReminders()
    } catch (err) {
      console.error('Toggle error:', err)
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
    <div className="max-w-4xl mx-auto space-y-8">
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
        <Card className={overdueReminders.length > 0 ? 'border-red-300' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${overdueReminders.length > 0 ? 'bg-red-100' : 'bg-warmgray-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${overdueReminders.length > 0 ? 'text-red-600' : 'text-warmgray-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-warmgray-900">{overdueReminders.length}</p>
                <p className="text-sm text-warmgray-500">Überfällig</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-warmgray-900">{upcomingReminders.length}</p>
                <p className="text-sm text-warmgray-500">In 30 Tagen fällig</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-sage-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-warmgray-900">{completedReminders.length}</p>
                <p className="text-sm text-warmgray-500">Erledigt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Neue Erinnerung
        </Button>
      </div>

      {/* Reminders List */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Offen ({pendingReminders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Erledigt ({completedReminders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingReminders.length > 0 ? (
            <div className="space-y-3">
              {pendingReminders.map((reminder) => {
                const typeInfo = REMINDER_TYPES[reminder.reminder_type]
                const TypeIcon = typeInfo.icon
                const daysUntil = getDaysUntil(reminder.due_date)
                
                return (
                  <div 
                    key={reminder.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${getUrgencyClass(reminder.due_date, reminder.is_completed)}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleToggleComplete(reminder)}
                        className="w-6 h-6 rounded-full border-2 border-warmgray-300 hover:border-sage-500 hover:bg-sage-50 transition-colors flex-shrink-0"
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-warmgray-900">{reminder.title}</p>
                        {reminder.description && (
                          <p className="text-sm text-warmgray-500">{reminder.description}</p>
                        )}
                        <p className="text-sm text-warmgray-500 mt-1">
                          {formatDate(reminder.due_date)}
                          {daysUntil < 0 && (
                            <span className="ml-2 text-red-600 font-medium">
                              ({Math.abs(daysUntil)} Tage überfällig)
                            </span>
                          )}
                          {daysUntil === 0 && (
                            <span className="ml-2 text-amber-600 font-medium">
                              (Heute fällig)
                            </span>
                          )}
                          {daysUntil > 0 && daysUntil <= 7 && (
                            <span className="ml-2 text-amber-600">
                              (in {daysUntil} Tagen)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleOpenDialog(reminder)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(reminder.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 text-warmgray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-warmgray-900 mb-2">
                  Keine offenen Erinnerungen
                </h3>
                <p className="text-warmgray-500 mb-4">
                  Erstellen Sie Erinnerungen für wichtige Fristen und Termine.
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
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
                const typeInfo = REMINDER_TYPES[reminder.reminder_type]
                const TypeIcon = typeInfo.icon
                
                return (
                  <div 
                    key={reminder.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-warmgray-200 bg-warmgray-50 opacity-60"
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleToggleComplete(reminder)}
                        className="w-6 h-6 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-warmgray-200 flex items-center justify-center">
                        <TypeIcon className="w-5 h-5 text-warmgray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-warmgray-700 line-through">{reminder.title}</p>
                        <p className="text-sm text-warmgray-500">
                          {formatDate(reminder.due_date)}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(reminder.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-warmgray-300 mx-auto mb-4" />
                <p className="text-warmgray-500">
                  Noch keine erledigten Erinnerungen
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingReminder ? 'Erinnerung bearbeiten' : 'Neue Erinnerung'}
            </DialogTitle>
            <DialogDescription>
              Erstellen Sie eine Erinnerung für wichtige Fristen oder Termine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="z.B. Personalausweis erneuern"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optionale Details..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Fälligkeitsdatum *</Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Art der Erinnerung</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(REMINDER_TYPES).map(([key, type]) => {
                  const Icon = type.icon
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.reminder_type === key
                          ? 'border-sage-500 bg-sage-50'
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
                      <Icon className={`w-5 h-5 ${form.reminder_type === key ? 'text-sage-600' : 'text-warmgray-400'}`} />
                      <span className="text-sm font-medium">{type.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
