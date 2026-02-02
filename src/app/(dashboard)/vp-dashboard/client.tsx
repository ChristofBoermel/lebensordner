'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Loader2, Users, User, Download, Mail, Calendar, CheckCircle2, ArrowRight, Eye, Crown, Lock, X, Info
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { DocumentViewer } from '@/components/ui/document-viewer'
import type { DocumentMetadata } from '@/types/database'

interface FamilyMember {
    id: string
    name: string
    email: string
    relationship: string
    direction: 'incoming' | 'outgoing'
    linkedAt: string | null
    tier?: {
        id: string
        name: string
        color: string
        badge: string
        canDownload: boolean
        viewOnly: boolean
    }
}

export default function FamilienUebersichtClientPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [members, setMembers] = useState<FamilyMember[]>([])
    const [downloadingFor, setDownloadingFor] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Modal view state
    const [viewingMember, setViewingMember] = useState<FamilyMember | null>(null)
    const [viewerDocuments, setViewerDocuments] = useState<DocumentMetadata[]>([])
    const [viewerCategories, setViewerCategories] = useState<Record<string, string>>({})
    const [viewerOwnerTier, setViewerOwnerTier] = useState<'free' | 'basic' | 'premium'>('free')
    const [isLoadingViewer, setIsLoadingViewer] = useState(false)

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

    const handleViewDocuments = async (member: FamilyMember) => {
        setViewingMember(member)
        setIsLoadingViewer(true)
        setViewerDocuments([])

        try {
            const response = await fetch(`/api/family/view?ownerId=${member.id}`)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Fehler beim Laden')
            }

            setViewerDocuments(data.documents || [])
            setViewerCategories(data.categories || {})
            setViewerOwnerTier(data.ownerTier || 'free')
        } catch (err: any) {
            setError(err.message)
            setViewingMember(null)
        } finally {
            setIsLoadingViewer(false)
        }
    }

    const closeViewer = () => {
        setViewingMember(null)
        setViewerDocuments([])
        setViewerCategories({})
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
        <TooltipProvider>
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
            <div className="page-header">
                <h1 className="text-3xl font-serif font-semibold text-warmgray-900">Familien-Übersicht</h1>
                <p className="text-lg text-warmgray-600 mt-2">
                    Zugriff auf Lebensordner Ihrer Familienmitglieder
                </p>
            </div>

            {/* Access-level summary banner */}
            {accessibleMembers.length > 0 && (() => {
                const hasDownloadAccess = accessibleMembers.some(m => m.tier?.canDownload)
                const hasViewOnlyAccess = accessibleMembers.some(m => m.tier?.viewOnly && !m.tier?.canDownload)
                const hasNoAccess = accessibleMembers.some(m => !m.tier?.canDownload && !m.tier?.viewOnly)

                if (hasDownloadAccess) {
                    return (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-green-50 border border-green-200">
                            <Download className="w-6 h-6 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-green-800">Vollständiger Download-Zugriff verfügbar</p>
                                <p className="text-sm text-green-700">
                                    Sie können Dokumente von Familienmitgliedern mit Premium-Abo herunterladen.
                                </p>
                            </div>
                        </div>
                    )
                } else if (hasViewOnlyAccess) {
                    return (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-blue-50 border border-blue-200">
                            <Eye className="w-6 h-6 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-blue-800">Nur-Ansicht-Zugriff verfügbar</p>
                                <p className="text-sm text-blue-700">
                                    Sie können Dokumente ansehen, aber nicht herunterladen. Downloads erfordern ein Premium-Abo des Dokumenteninhabers.
                                </p>
                            </div>
                        </div>
                    )
                } else if (hasNoAccess) {
                    return (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-warmgray-50 border border-warmgray-200">
                            <Lock className="w-6 h-6 sm:w-5 sm:h-5 text-warmgray-500 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-warmgray-700">Kein Zugriff verfügbar</p>
                                <p className="text-sm text-warmgray-600">
                                    Die verbundenen Familienmitglieder benötigen ein kostenpflichtiges Abo, um Ihnen Zugriff zu gewähren.
                                </p>
                            </div>
                        </div>
                    )
                }
                return null
            })()}

            {error && (
                <div className="p-3 sm:p-4 rounded-lg bg-red-50 border border-red-200 text-sm sm:text-base text-red-700">
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
                                    <Card key={member.id} className={`hover:border-sage-300 transition-colors border-l-4 ${
                                        member.tier?.canDownload ? 'border-l-green-500' :
                                        member.tier?.viewOnly ? 'border-l-blue-500' : 'border-l-warmgray-300'
                                    }`}>
                                        <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
                                            <div className="flex flex-col gap-4 sm:gap-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                                                        <User className="w-6 h-6 sm:w-7 sm:h-7 text-sage-600" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold text-warmgray-900 text-base sm:text-lg truncate">{member.name}</h3>
                                                            {member.tier && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className={`text-xs px-2 py-0.5 sm:py-1 rounded-full ${member.tier.badge} ${member.tier.color} flex items-center gap-1 cursor-help whitespace-nowrap`}>
                                                                            {member.tier.id === 'premium' && <Crown className="w-3 h-3" />}
                                                                            {member.tier.name}
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="max-w-xs">
                                                                        {member.tier.canDownload ? (
                                                                            <p>Premium-Mitglied - Sie können alle Dokumente herunterladen</p>
                                                                        ) : member.tier.viewOnly ? (
                                                                            <p>Basis-Mitglied - Sie können Dokumente nur ansehen</p>
                                                                        ) : (
                                                                            <p>Kostenloses Konto - Kein Zugriff verfügbar</p>
                                                                        )}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                        <p className="text-warmgray-600 text-sm sm:text-base">{member.relationship}</p>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 sm:gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm text-warmgray-500">
                                                            <span className="flex items-center gap-1.5 truncate">
                                                                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                                                {member.email}
                                                            </span>
                                                            {member.linkedAt && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    Verbunden seit {new Date(member.linkedAt).toLocaleDateString('de-DE')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto">
                                                    {member.tier?.canDownload ? (
                                                        <Button
                                                            onClick={() => handleDownloadDocuments(member.id, member.name)}
                                                            disabled={downloadingFor === member.id}
                                                            className="w-full sm:min-w-[160px] lg:min-w-[180px] sm:w-auto text-sm sm:text-base"
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
                                                    ) : member.tier?.viewOnly ? (
                                                        <div className="flex flex-col items-center sm:items-end gap-1">
                                                            <Button
                                                                onClick={() => handleViewDocuments(member)}
                                                                variant="outline"
                                                                className="w-full sm:min-w-[160px] lg:min-w-[180px] sm:w-auto border-blue-200 text-blue-700 hover:bg-blue-50 text-sm sm:text-base"
                                                            >
                                                                <Eye className="w-4 h-4 mr-2" />
                                                                Nur Ansicht
                                                            </Button>
                                                            <span className="text-xs text-center sm:text-left text-warmgray-500">
                                                                Downloads mit Premium verfügbar
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center sm:items-end gap-1">
                                                            <Button
                                                                disabled
                                                                variant="outline"
                                                                className="w-full sm:min-w-[160px] lg:min-w-[180px] sm:w-auto opacity-50 text-sm sm:text-base"
                                                            >
                                                                <Lock className="w-4 h-4 mr-2" />
                                                                Abo erforderlich
                                                            </Button>
                                                            <span className="text-xs text-center sm:text-left text-warmgray-500">
                                                                Diese Person benötigt ein Basis- oder Premium-Abo
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
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
                                    <Card key={member.id} className="opacity-80 mx-0">
                                        <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
                                            <div className="flex flex-col gap-4 sm:gap-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-warmgray-100 flex items-center justify-center flex-shrink-0">
                                                        <User className="w-6 h-6 sm:w-7 sm:h-7 text-warmgray-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="font-semibold text-warmgray-900 text-base sm:text-lg truncate">{member.name}</h3>
                                                        <p className="text-warmgray-600 text-sm sm:text-base">{member.relationship}</p>
                                                        <div className="mt-1 text-xs sm:text-sm text-warmgray-500 truncate">
                                                            <span className="flex items-center gap-1.5">
                                                                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                                                {member.email}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <span className="text-xs sm:text-sm text-green-600 bg-green-50 px-3 py-2 sm:px-4 sm:py-2 rounded-full flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto border border-green-100">
                                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
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
                                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                                    <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-lg bg-sage-100 flex items-center justify-center flex-shrink-0">
                                        <ArrowRight className="w-6 h-6 sm:w-5 sm:h-5 text-sage-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-warmgray-900 mb-1 text-sm sm:text-base">So funktioniert die Familien-Übersicht</p>
                                        <p className="text-xs sm:text-sm text-warmgray-600">
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

            {/* Document Viewer Modal */}
            <Dialog open={!!viewingMember} onOpenChange={(open) => !open && closeViewer()}>
                <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] lg:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-base sm:text-lg">
                            <span>Dokumente ansehen</span>
                        </DialogTitle>
                    </DialogHeader>

                    {isLoadingViewer ? (
                        <div className="flex items-center justify-center py-8 sm:py-12">
                            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-sage-600" />
                        </div>
                    ) : viewingMember && (
                        <DocumentViewer
                            documents={viewerDocuments}
                            ownerName={viewingMember.name}
                            ownerTier={viewerOwnerTier}
                            categories={viewerCategories}
                            viewMode="modal"
                            showHeader={true}
                            showInfoBanner={true}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    )
}
