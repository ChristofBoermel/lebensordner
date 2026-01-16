'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users, FileText, HardDrive, CreditCard, TrendingUp, Shield,
  Search, Loader2, AlertTriangle, CheckCircle2, Clock, Crown,
  UserCheck, UserX, RefreshCw
} from 'lucide-react'

interface PlatformStats {
  total_users: number
  active_subscriptions: number
  trialing_users: number
  total_documents: number
  total_storage_used_mb: number
  users_completed_onboarding: number
  users_last_7_days: number
  users_last_30_days: number
}

interface UserData {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  onboarding_completed: boolean
  subscription_status: string | null
  storage_used: number
}

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [users, setUsers] = useState<UserData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  const checkAdminAccess = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/anmelden')
      return false
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      setIsAdmin(false)
      setIsLoading(false)
      return false
    }

    setIsAdmin(true)
    return true
  }, [supabase, router])

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_platform_stats')
      if (error) throw error
      setStats(data)
    } catch (err: any) {
      console.error('Stats error:', err)
      setError('Statistiken konnten nicht geladen werden')
    }
  }, [supabase])

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_users')
      if (error) throw error
      setUsers(data || [])
    } catch (err: any) {
      console.error('Users error:', err)
    }
  }, [supabase])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const hasAccess = await checkAdminAccess()
    if (hasAccess) {
      await Promise.all([fetchStats(), fetchUsers()])
    }
    setIsLoading(false)
  }, [checkAdminAccess, fetchStats, fetchUsers])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: newRole
      })
      if (error) throw error
      fetchUsers()
    } catch (err: any) {
      console.error('Role update error:', err)
      alert('Fehler beim Aktualisieren der Rolle')
    }
  }

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (date: string) => new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const formatStorage = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-semibold text-warmgray-900 mb-2">Zugriff verweigert</h1>
        <p className="text-warmgray-600 mb-4">Sie haben keine Berechtigung für den Admin-Bereich.</p>
        <Button onClick={() => router.push('/dashboard')}>Zurück zum Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-warmgray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-sage-600" />
            Admin Dashboard
          </h1>
          <p className="text-lg text-warmgray-600 mt-1">Plattform-Übersicht und Benutzerverwaltung</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-sage-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.total_users}</p>
                  <p className="text-sm text-warmgray-500">Nutzer gesamt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.active_subscriptions}</p>
                  <p className="text-sm text-warmgray-500">Aktive Abos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.trialing_users}</p>
                  <p className="text-sm text-warmgray-500">In Testphase</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.total_documents}</p>
                  <p className="text-sm text-warmgray-500">Dokumente</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.total_storage_used_mb.toFixed(1)} MB</p>
                  <p className="text-sm text-warmgray-500">Speicher genutzt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-sage-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.users_completed_onboarding}</p>
                  <p className="text-sm text-warmgray-500">Onboarding fertig</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.users_last_7_days}</p>
                  <p className="text-sm text-warmgray-500">Neue (7 Tage)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warmgray-900">{stats.users_last_30_days}</p>
                  <p className="text-sm text-warmgray-500">Neue (30 Tage)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Benutzerverwaltung</CardTitle>
          <CardDescription>Alle registrierten Benutzer verwalten</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
              <Input
                placeholder="Nach E-Mail oder Name suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-warmgray-200">
                  <th className="text-left py-3 px-4 font-medium text-warmgray-600">Benutzer</th>
                  <th className="text-left py-3 px-4 font-medium text-warmgray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-warmgray-600">Abo</th>
                  <th className="text-left py-3 px-4 font-medium text-warmgray-600">Speicher</th>
                  <th className="text-left py-3 px-4 font-medium text-warmgray-600">Registriert</th>
                  <th className="text-left py-3 px-4 font-medium text-warmgray-600">Rolle</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-warmgray-100 hover:bg-warmgray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-warmgray-900">{user.full_name || '-'}</p>
                        <p className="text-sm text-warmgray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {user.onboarding_completed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3" /> Aktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" /> Onboarding
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.subscription_status === 'active' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-sage-100 text-sage-700">
                          <Crown className="w-3 h-3" /> Premium
                        </span>
                      )}
                      {user.subscription_status === 'trialing' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Clock className="w-3 h-3" /> Trial
                        </span>
                      )}
                      {!user.subscription_status && (
                        <span className="text-warmgray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-warmgray-600">
                      {formatStorage(user.storage_used)}
                    </td>
                    <td className="py-3 px-4 text-sm text-warmgray-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="text-sm border border-warmgray-200 rounded px-2 py-1"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-warmgray-500">
                Keine Benutzer gefunden
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
