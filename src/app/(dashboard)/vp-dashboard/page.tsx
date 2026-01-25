'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2, Users, User, Download, Mail, Calendar, CheckCircle2, ArrowRight
} from 'lucide-react'

interface FamilyMember {
  id: string
  name: string
  email: string
  relationship: string
  direction: 'incoming' | 'outgoing'
  linkedAt: string | null
}

export default function FamilienUebersichtPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Link any pending invitations when page loads
  const linkPendingInvitations = useCallback(async () => {
    try {
      await fetch('/api/trusted-person/link', { method: 'POST' })
    } catch (err) {
      console.error('Error linking invitations:', err)
    }
  }, [])

  const fetchFamilyMembers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/family/members')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setMembers(data.members || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await linkPendingInvitations()
      await fetchFamilyMembers()
    }
    init()
  }, [linkPendingInvitations, fetchFamilyMembers])

  const handleDownloadDocuments = async (memberId: string, memberName: string) => {
    setDownloadingFor(memberId)
    setError(null)

    try {
      const response = await fetch(`/api/family/download?ownerId=${memberId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Download fehlgeschlagen')
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `Lebensordner_${memberName.replace(/\s+/g, '_')}.zip`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDownloadingFor(null)
    }
  }

  // Filter: Only show members where I can download their documents (they added me = incoming)
  const accessibleMembers = members.filter(m => m.direction === 'incoming')
  const outgoingMembers = members.filter(m => m.direction === 'outgoing')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">Familien-Übersicht</h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Zugriff auf Lebensordner Ihrer Familienmitglieder
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {members.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Users className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-warmgray-900 mb-2">
              Keine Familien-Verbindungen
            </h3>
            <p className="text-warmgray-600 max-w-md mx-auto mb-6">
              Sie haben noch keine Familien-Verbindungen. Wenn jemand Sie als
              Vertrauensperson zu seinem Lebensordner hinzufügt, erscheint die Person hier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Accessible Members - they added me */}
          {accessibleMembers.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-warmgray-900">Zugriff auf Dokumente</h2>
                <p className="text-warmgray-600 text-sm mt-1">
                  Diese Personen haben Sie als Vertrauensperson hinzugefügt
                </p>
              </div>

              <div className="grid gap-4">
                {accessibleMembers.map((member) => (
                  <Card key={member.id} className="hover:border-sage-300 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center">
                            <User className="w-7 h-7 text-sage-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-warmgray-900 text-lg">{member.name}</h3>
                            <p className="text-warmgray-600">{member.relationship}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-warmgray-500">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                {member.email}
                              </span>
                              {member.linkedAt && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Verbunden seit {new Date(member.linkedAt).toLocaleDateString('de-DE')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleDownloadDocuments(member.id, member.name)}
                          disabled={downloadingFor === member.id}
                          className="min-w-[180px]"
                        >
                          {downloadingFor === member.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Wird geladen...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Dokumente laden
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing Members - I added them */}
          {outgoingMembers.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-warmgray-900">Ihre Vertrauenspersonen</h2>
                <p className="text-warmgray-600 text-sm mt-1">
                  Diese Personen haben Ihre Einladung akzeptiert und können Ihre Dokumente sehen
                </p>
              </div>

              <div className="grid gap-4">
                {outgoingMembers.map((member) => (
                  <Card key={member.id} className="opacity-80">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-warmgray-100 flex items-center justify-center">
                            <User className="w-7 h-7 text-warmgray-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-warmgray-900 text-lg">{member.name}</h3>
                            <p className="text-warmgray-600">{member.relationship}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-warmgray-500">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                {member.email}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Hat Zugriff auf Ihre Dokumente
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Info box if user only has outgoing members */}
          {accessibleMembers.length === 0 && outgoingMembers.length > 0 && (
            <Card className="border-sage-200 bg-sage-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-5 h-5 text-sage-600" />
                  </div>
                  <div>
                    <p className="font-medium text-warmgray-900 mb-1">So funktioniert die Familien-Übersicht</p>
                    <p className="text-sm text-warmgray-600">
                      Um Dokumente von Familienmitgliedern herunterzuladen, muss die andere Person Sie
                      zuerst als Vertrauensperson hinzufügen. Bitten Sie Ihre Familienmitglieder, Sie über
                      <span className="font-medium"> Zugriff & Familie</span> einzuladen.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
