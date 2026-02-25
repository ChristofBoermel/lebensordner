'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useVault } from '@/lib/vault/VaultContext'
import { VaultUnlockModal } from '@/components/vault/VaultUnlockModal'
import { BulkShareDialog } from '@/components/sharing/BulkShareDialog'
import { ActiveSharesList } from '@/components/sharing/ActiveSharesList'
import { ReceivedSharesList } from '@/components/sharing/ReceivedSharesList'
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
  Users,
  UserPlus,
  User,
  Shield,
  Mail,
  Phone,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Crown,
  Link2,
  Clock,
  Download,
  Copy,
  ExternalLink,
  Info,
  Eye,
  Lock,
  Calendar,
  ArrowRight,
  FileText,
  Key,
  Share2,
} from 'lucide-react'
import type { TrustedPerson, DocumentMetadata } from '@/types/database'
import { SUBSCRIPTION_TIERS, canPerformAction, allowsFamilyDownloads, type TierConfig } from '@/lib/subscription-tiers'
import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TierStatusCard, InfoBadge } from '@/components/ui/info-badge'

// Lazy load DocumentViewer for performance
const DocumentViewer = dynamic(
  () => import('@/components/ui/document-viewer').then(mod => mod.DocumentViewer),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-sage-600" /></div> }
)

// Family member interface
interface FamilyMember {
  id: string
  name: string
  email: string
  relationship: string
  direction: 'incoming' | 'outgoing'
  linkedAt: string | null
  docsCount?: number
  tier?: {
    id: string
    name: string
    color: string
    badge: string
    canDownload: boolean
    viewOnly: boolean
  }
}

interface StripePriceIds {
  basic: { monthly: string; yearly: string }
  premium: { monthly: string; yearly: string }
  family: { monthly: string; yearly: string }
}

export default function ZugriffPage() {
  const [trustedPersons, setTrustedPersons] = useState<TrustedPerson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDownloadLinkDialogOpen, setIsDownloadLinkDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<TrustedPerson | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)
  const [priceIds, setPriceIds] = useState<StripePriceIds | null>(null)

  const [downloadLinkForm, setDownloadLinkForm] = useState({
    name: '',
    email: '',
  })
  const [generatedLink, setGeneratedLink] = useState<{ url: string; expiresAt: string; linkType?: 'view' | 'download' } | null>(null)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const vaultContext = useVault()
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false)
  const [rkShareUrl, setRkShareUrl] = useState<string | null>(null)
  const [isGeneratingRk, setIsGeneratingRk] = useState<string | null>(null)
  const [rkDialogOpen, setRkDialogOpen] = useState(false)
  const [rkLinkCopied, setRkLinkCopied] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: '',
    notes: '',
  })

  // Familie Tab State
  const [activeMainTab, setActiveMainTab] = useState('vertrauenspersonen')
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)
  const [viewingMember, setViewingMember] = useState<FamilyMember | null>(null)
  const [viewerDocuments, setViewerDocuments] = useState<DocumentMetadata[]>([])
  const [viewerCategories, setViewerCategories] = useState<Record<string, string>>({})
  const [viewerOwnerTier, setViewerOwnerTier] = useState<'free' | 'basic' | 'premium'>('free')
  const [isLoadingViewer, setIsLoadingViewer] = useState(false)
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null)

  const [isBulkShareOpen, setIsBulkShareOpen] = useState(false)
  const [sharesVersion, setSharesVersion] = useState(0)
  const [sharingDocuments, setSharingDocuments] = useState<Array<{id: string; title: string; wrapped_dek: string | null}>>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createClient()

  // Fetch Stripe price IDs from API
  useEffect(() => {
    async function fetchPriceIds() {
      try {
        const response = await fetch('/api/stripe/prices')
        const data = await response.json()
        setPriceIds(data)
      } catch (err) {
        console.error('Failed to fetch price IDs:', err)
      }
    }
    fetchPriceIds()
  }, [])

  // Family members filtering - memoized for performance
  const accessibleMembers = useMemo(
    () => familyMembers.filter(m => m.direction === 'incoming'),
    [familyMembers]
  )
  const outgoingMembers = useMemo(
    () => familyMembers.filter(m => m.direction === 'outgoing'),
    [familyMembers]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.location.hash === '#familie') {
      setActiveMainTab('familie')
    }
  }, [])

  // Determine current tier based on price ID
  // This mirrors the server-side getTierFromSubscription logic exactly
  const getCurrentTier = useCallback((
    status: string | null,
    priceId: string | null
  ): TierConfig => {
    const normalizedPriceId = priceId?.toLowerCase() ?? null
    const normalizedPriceIds = {
      basic: {
        monthly: priceIds?.basic?.monthly?.toLowerCase() ?? '',
        yearly: priceIds?.basic?.yearly?.toLowerCase() ?? '',
      },
      premium: {
        monthly: priceIds?.premium?.monthly?.toLowerCase() ?? '',
        yearly: priceIds?.premium?.yearly?.toLowerCase() ?? '',
      },
      family: {
        monthly: priceIds?.family?.monthly?.toLowerCase() ?? '',
        yearly: priceIds?.family?.yearly?.toLowerCase() ?? '',
      },
    }

    // No status or canceled → free (matches server logic)
    if (!status || status === 'canceled') return SUBSCRIPTION_TIERS.free

    // Only active/trialing subscriptions continue
    const isActiveOrTrialing = status === 'active' || status === 'trialing'
    if (!isActiveOrTrialing) return SUBSCRIPTION_TIERS.free

    // If priceIds not loaded yet, return 'free' as safe temporary fallback
    if (!priceIds) return SUBSCRIPTION_TIERS.free

    // Check basic tier price IDs
    if (
      normalizedPriceId === normalizedPriceIds.basic.monthly
      || normalizedPriceId === normalizedPriceIds.basic.yearly
    ) {
      return SUBSCRIPTION_TIERS.basic
    }

    // Check premium tier price IDs
    if (
      normalizedPriceId === normalizedPriceIds.premium.monthly
      || normalizedPriceId === normalizedPriceIds.premium.yearly
    ) {
      return SUBSCRIPTION_TIERS.premium
    }

    // Family tier price IDs are treated as premium tier for feature access
    if (
      normalizedPriceId === normalizedPriceIds.family.monthly
      || normalizedPriceId === normalizedPriceIds.family.yearly
    ) {
      return SUBSCRIPTION_TIERS.premium
    }

    // Null or unknown price_id with active subscription → basic (matches server logic)
    if (!normalizedPriceId) {
      return SUBSCRIPTION_TIERS.basic
    }

    // Unrecognized price_id → basic (matches server logic)
    return SUBSCRIPTION_TIERS.basic
  }, [priceIds])

  // Fetch user tier
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
        // Log tier detection in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('[Zugriff Page] Profile data:', {
            subscription_status: profile.subscription_status,
            stripe_price_id: profile.stripe_price_id,
          })
        }

        const tier = getCurrentTier(profile.subscription_status, profile.stripe_price_id)

        if (process.env.NODE_ENV === 'development') {
          console.log('[Zugriff Page] Detected tier:', tier.id, tier.name)
        }

        setUserTier(tier)
      }
    }
    fetchTier()
  }, [supabase, getCurrentTier, priceIds])

  const fetchTrustedPersons = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('trusted_persons')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTrustedPersons(data)
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchTrustedPersons()
  }, [fetchTrustedPersons])

  // Link pending invitations when page loads
  const linkPendingInvitations = useCallback(async () => {
    try {
      await fetch('/api/trusted-person/link', { method: 'POST' })
    } catch (err) {
      console.error('Error linking invitations:', err)
    }
  }, [])

  // Fetch family members for Familie tab
  const fetchFamilyMembers = useCallback(async () => {
    setIsFamilyLoading(true)
    try {
      const response = await fetch('/api/family/members')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Laden')
      }

      setFamilyMembers(data.members || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsFamilyLoading(false)
    }
  }, [])

  // Load family members when Familie tab becomes active
  useEffect(() => {
    if (activeMainTab === 'familie' && familyMembers.length === 0 && !isFamilyLoading) {
      linkPendingInvitations().then(() => fetchFamilyMembers())
    }
  }, [activeMainTab, familyMembers.length, isFamilyLoading, linkPendingInvitations, fetchFamilyMembers])

  // Fetch current user ID and documents for bulk share dialog
  useEffect(() => {
    if (activeMainTab !== 'familie') return
    async function fetchUserAndDocs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, wrapped_dek')
        .eq('user_id', user.id)
      if (docs) setSharingDocuments(docs)
    }
    fetchUserAndDocs()
  }, [activeMainTab, supabase])

  // Prefetch family members API for faster tab switch
  useEffect(() => {
    if (userTier.limits.familyDashboard) {
      fetch('/api/family/members', { method: 'HEAD' }).catch(() => {})
    }
  }, [userTier])

  // Prefetch view API for accessible members when Familie tab is active
  useEffect(() => {
    if (userTier.limits.familyDashboard && activeMainTab === 'familie') {
      accessibleMembers.forEach(member => {
        if (member.tier?.viewOnly || member.tier?.canDownload) {
          fetch(`/api/family/view?ownerId=${member.id}`, { method: 'HEAD' }).catch(() => {})
        }
      })
    }
  }, [userTier, activeMainTab, accessibleMembers])

  // Handle viewing documents for a family member
  const handleViewDocuments = useCallback(async (member: FamilyMember) => {
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
  }, [])

  // Handle downloading documents for a family member
  const handleDownloadDocuments = useCallback(async (memberId: string, memberName: string) => {
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
  }, [])

  // Close document viewer
  const closeViewer = useCallback(() => {
    setViewingMember(null)
    setViewerDocuments([])
    setViewerCategories({})
  }, [])

  const handleOpenDialog = (person?: TrustedPerson) => {
    if (person) {
      setEditingPerson(person)
      setForm({
        name: person.name,
        email: person.email,
        phone: person.phone || '',
        relationship: person.relationship,
        notes: person.notes || '',
      })
    } else {
      setEditingPerson(null)
      setForm({
        name: '',
        email: '',
        phone: '',
        relationship: '',
        notes: '',
      })
    }
    setError(null)
    setIsDialogOpen(true)
  }

  const handleOpenDownloadLinkDialog = () => {
    setDownloadLinkForm({ name: '', email: '' })
    setGeneratedLink(null)
    setError(null)
    setIsDownloadLinkDialogOpen(true)
  }

  const handleGenerateDownloadLink = async () => {
    // Tier gate: Basic and Premium users can create links
    if (userTier.id === 'free') {
      setError('Links sind nur mit einem kostenpflichtigen Abo verfügbar. Bitte upgraden Sie Ihr Konto.')
      return
    }

    if (!downloadLinkForm.name || !downloadLinkForm.email) {
      setError('Bitte füllen Sie Name und E-Mail aus.')
      return
    }

    setIsGeneratingLink(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Nicht angemeldet')
      }

      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('id, is_encrypted, wrapped_dek, file_iv, file_name_encrypted, file_name')
        .eq('user_id', user.id)

      if (documentsError) {
        throw new Error('Fehler beim Laden der Dokumente')
      }

      const hasEncryptedDocuments = (documents || []).some((doc) => doc.is_encrypted)

      if (hasEncryptedDocuments && !vaultContext.isUnlocked) {
        setIsVaultModalOpen(true)
        return
      }

      let shareKey: string | undefined
      let wrappedDeks: { documentId: string; wrappedDekForShare: string; fileIv: string; fileNameEncrypted?: string }[] | undefined

      if (hasEncryptedDocuments && vaultContext.isUnlocked) {
        const { unwrapKey, importRawHexKey, wrapKey } = await import('@/lib/security/document-e2ee')
        const randomBytes = crypto.getRandomValues(new Uint8Array(32))
        shareKey = Array.from(randomBytes)
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')

        const shareKeyAes = await importRawHexKey(shareKey, ['wrapKey', 'unwrapKey'])

        wrappedDeks = await Promise.all(
          (documents || [])
            .filter((doc) => doc.is_encrypted)
            .map(async (doc) => {
              const dek = await unwrapKey(doc.wrapped_dek, vaultContext.masterKey!, 'AES-GCM')
              const wrappedDekForShare = await wrapKey(dek, shareKeyAes)
              return {
                documentId: doc.id,
                wrappedDekForShare,
                fileIv: doc.file_iv,
                fileNameEncrypted: doc.file_name_encrypted || undefined,
              }
            })
        )
      }

      const documentIds = (documents || []).map((doc) => doc.id)

      const response = await fetch('/api/download-link/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: downloadLinkForm.name,
          recipientEmail: downloadLinkForm.email,
          documentIds,
          shareKey,
          wrappedDeks,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen')
      }

      setGeneratedLink({
        url: data.downloadUrl,
        expiresAt: data.expiresAt,
        linkType: data.linkType || 'download',
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleGenerateRelationshipKey = async (person: TrustedPerson) => {
    if (!vaultContext.isUnlocked || !vaultContext.masterKey) {
      setIsVaultModalOpen(true)
      return
    }

    setIsGeneratingRk(person.id)

    try {
      const { generateRelationshipKey, importRawHexKey, wrapKey, unwrapKey } = await import('@/lib/security/document-e2ee')
      const rk = await generateRelationshipKey()
      const rkCryptoKey = await importRawHexKey(rk, ['wrapKey', 'unwrapKey'])
      const wrapped_rk = await wrapKey(rkCryptoKey, vaultContext.masterKey)

      await fetch('/api/trusted-person/relationship-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trustedPersonId: person.id,
          wrapped_rk,
        }),
      })

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Nicht angemeldet')
      }

      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('id, wrapped_dek, file_iv, is_encrypted')
        .eq('user_id', user.id)
        .eq('is_encrypted', true)

      if (documentsError) {
        throw new Error('Fehler beim Laden der Dokumente')
      }

      await Promise.all(
        (documents || []).map(async (doc) => {
          try {
            const dek = await unwrapKey(doc.wrapped_dek, vaultContext.masterKey!, 'AES-GCM')
            const wrapped_dek_for_tp = await wrapKey(dek, rkCryptoKey)

            await fetch('/api/documents/share-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                documentId: doc.id,
                trustedPersonId: person.id,
                wrapped_dek_for_tp,
              }),
            })
          } catch {
            // Skip documents that fail to re-wrap for this trusted person.
          }
        })
      )

      const shareUrl = `${window.location.origin}/zugriff/access?ownerId=${user.id}#${rk}`

      setRkShareUrl(shareUrl)
      setRkDialogOpen(true)
    } catch (err: any) {
      alert('Fehler beim Erstellen des Zugriffslinks: ' + err.message)
    } finally {
      setIsGeneratingRk(null)
    }
  }

  const copyLinkToClipboard = async () => {
    if (generatedLink?.url) {
      await navigator.clipboard.writeText(generatedLink.url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.email || !form.relationship) {
      setError('Bitte füllen Sie alle Pflichtfelder aus.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      const normalizedEmail = form.email.toLowerCase().trim()

      if (editingPerson) {
        // Check for duplicate email when editing (exclude current person)
        // Use case-insensitive comparison with ilike
        const { data: duplicateCheck } = await supabase
          .from('trusted_persons')
          .select('id')
          .eq('user_id', user.id)
          .ilike('email', normalizedEmail)
          .neq('id', editingPerson.id)
          .maybeSingle()

        if (duplicateCheck) {
          setError('Diese E-Mail-Adresse wurde bereits hinzugefügt.')
          setIsSaving(false)
          return
        }

        const { error } = await supabase
          .from('trusted_persons')
          .update({
            name: form.name,
            email: normalizedEmail,
            phone: form.phone || null,
            relationship: form.relationship,
            notes: form.notes || null,
          })
          .eq('id', editingPerson.id)

        if (error) throw error
      } else {
        if (!canPerformAction(userTier, 'addTrustedPerson', trustedPersons.length)) {
          if (userTier.limits.maxTrustedPersons === 0) {
            setError('Vertrauenspersonen sind nur mit einem kostenpflichtigen Abo verfügbar.')
          } else {
            setError(`Sie können maximal ${userTier.limits.maxTrustedPersons} Vertrauenspersonen hinzufügen. Upgraden Sie für mehr.`)
          }
          return
        }

        // Check for duplicate email when adding new person
        // Use case-insensitive comparison with ilike
        const { data: duplicateCheck } = await supabase
          .from('trusted_persons')
          .select('id')
          .eq('user_id', user.id)
          .ilike('email', normalizedEmail)
          .maybeSingle()

        if (duplicateCheck) {
          setError('Diese E-Mail-Adresse wurde bereits hinzugefügt.')
          setIsSaving(false)
          return
        }

        const { error } = await supabase
          .from('trusted_persons')
          .insert({
            user_id: user.id,
            name: form.name,
            email: normalizedEmail,
            phone: form.phone || null,
            relationship: form.relationship,
            access_level: 'immediate', // Default to immediate access for family dashboard
            access_delay_hours: 0,
            notes: form.notes || null,
          })

        if (error) throw error
      }

      setIsDialogOpen(false)
      fetchTrustedPersons()
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
      console.error('Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Person wirklich entfernen?')) return

    try {
      const { error } = await supabase
        .from('trusted_persons')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchTrustedPersons()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleSendInvite = async (personId: string) => {
    try {
      const response = await fetch('/api/trusted-person/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedPersonId: personId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Senden')
      }

      alert('Einladung wurde erfolgreich gesendet!')
      fetchTrustedPersons()
    } catch (err: any) {
      alert('Fehler: ' + err.message)
      console.error('Invite error:', err)
    }
  }

  const handleToggleActive = async (person: TrustedPerson) => {
    try {
      const { error } = await supabase
        .from('trusted_persons')
        .update({ is_active: !person.is_active })
        .eq('id', person.id)

      if (error) throw error
      fetchTrustedPersons()
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const activePersons = trustedPersons.filter(p => p.is_active)
  const inactivePersons = trustedPersons.filter(p => !p.is_active)
  const maxTrustedPersons = userTier.limits.maxTrustedPersons
  const canAddMore = canPerformAction(userTier, 'addTrustedPerson', trustedPersons.length)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    )
  }

  return (
    <TooltipProvider>
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Zugriff & Familie
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Teilen Sie Ihre Dokumente mit vertrauten Personen
        </p>
      </div>

      {/* Tier Status Card */}
      <TierStatusCard tier={userTier.id} />

      {/* Main Tabs: Vertrauenspersonen and Familie */}
      <Tabs
        value={activeMainTab}
        onValueChange={setActiveMainTab}
        className="space-y-6"
        aria-label="Zugriff und Familie Navigation"
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="vertrauenspersonen" className="flex-1 sm:flex-initial">
            <Users className="w-4 h-4 mr-2" aria-hidden="true" />
            Vertrauenspersonen
          </TabsTrigger>
          <TabsTrigger value="familie" className="flex-1 sm:flex-initial">
            <User className="w-4 h-4 mr-2" aria-hidden="true" />
            Familie
          </TabsTrigger>
        </TabsList>

        {/* Vertrauenspersonen Tab Content */}
        <TabsContent value="vertrauenspersonen" className="space-y-6 mt-6">
          {/* Two Options Cards */}
          <div className="grid md:grid-cols-2 gap-6">
        {/* Option 1: One-Time Download Link */}
        <Card className="border-sage-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-sage-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Einmal-Download-Link</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-warmgray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {userTier.id === 'premium' ? (
                        <p>Mit Ihrem Premium-Abo können Empfänger alle Dokumente herunterladen</p>
                      ) : userTier.id === 'basic' ? (
                        <p>Mit Ihrem Basis-Abo können Empfänger Dokumente nur ansehen, nicht herunterladen</p>
                      ) : (
                        <p>Upgraden Sie auf Basis oder Premium, um diese Funktion zu nutzen</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>Für schnellen Zugriff ohne Anmeldung</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-warmgray-600">
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Link ist 12 Stunden gültig</span>
              </li>
              <li className="flex items-start gap-2">
                {userTier.id === 'premium' ? (
                  <>
                    <Download className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                    <span>Alle Dokumente als ZIP-Datei</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                    <span>Alle Dokumente ansehen (nur Ansicht)</span>
                  </>
                )}
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Keine Registrierung nötig</span>
              </li>
            </ul>
            {userTier.id === 'premium' ? (
              <Button
                onClick={handleOpenDownloadLinkDialog}
                className="w-full"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Download-Link erstellen
              </Button>
            ) : userTier.id === 'basic' ? (
              <div className="space-y-2">
                <Button
                  onClick={handleOpenDownloadLinkDialog}
                  className="w-full"
                  variant="outline"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ansichts-Link erstellen
                </Button>
                <p className="text-xs text-center text-warmgray-500">
                  <Link href="/abo" className="text-sage-600 hover:underline">Upgrade auf Premium</Link> für Download-Links
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  disabled
                  className="w-full opacity-50"
                  variant="outline"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Kostenpflichtige Funktion
                </Button>
                <p className="text-xs text-center text-warmgray-500">
                  <Link href="/abo" className="text-sage-600 hover:underline">Jetzt upgraden</Link> um Links zu erstellen
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Option 2: Family Dashboard Invitation */}
        <Card className="border-sage-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-sage-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Familien-Übersicht</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-warmgray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {userTier.id === 'premium' ? (
                        <p>Ihre Vertrauenspersonen können Dokumente ansehen und herunterladen</p>
                      ) : userTier.id === 'basic' ? (
                        <p>Ihre Vertrauenspersonen können Dokumente nur ansehen (Upgrade auf Premium für Downloads)</p>
                      ) : (
                        <p>Upgraden Sie auf ein kostenpflichtiges Abo, um diese Funktion zu nutzen</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>Dauerhafter Zugang mit eigenem Konto</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-warmgray-600">
              <li className="flex items-start gap-2">
                <Users className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Gegenseitige Verbindung in der Familie</span>
              </li>
              <li className="flex items-start gap-2">
                <Download className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Jederzeit Dokumente herunterladen</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-sage-500 mt-0.5 flex-shrink-0" />
                <span>Registrierung erforderlich</span>
              </li>
            </ul>
            <Button
              onClick={() => handleOpenDialog()}
              className="w-full"
              disabled={!canAddMore}
              variant="outline"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Person einladen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade prompt for free tier */}
      {maxTrustedPersons === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Crown className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 mb-1">Premium-Funktion</p>
                <p className="text-sm text-amber-800 mb-3">
                  Mit einem kostenpflichtigen Abo können Sie Dokumente mit Vertrauenspersonen teilen.
                </p>
                <Link href="/abo">
                  <Button size="sm" variant="outline" className="border-amber-300 hover:bg-amber-100">
                    Jetzt upgraden
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade prompt for Basic tier */}
      {userTier.id === 'basic' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Download className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-orange-900 mb-1">Upgrade auf Premium für Download-Zugriff</p>
                <p className="text-sm text-orange-800 mb-3">
                  Mit Ihrem Basis-Abo können Ihre Vertrauenspersonen Dokumente nur ansehen. Upgraden Sie auf Premium, damit sie Dokumente auch herunterladen können.
                </p>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span className="text-orange-800">Aktuell: <strong>Nur Ansicht</strong></span>
                  </div>
                  <span className="text-orange-400">→</span>
                  <div className="flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4 text-green-600" />
                    <span className="text-orange-800">Mit Premium: <strong>Ansicht + Download</strong></span>
                  </div>
                </div>
                <Link href="/abo">
                  <Button size="sm" variant="outline" className="border-orange-300 hover:bg-orange-100">
                    Auf Premium upgraden
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trusted Persons List */}
      {trustedPersons.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-warmgray-900">Eingeladene Personen</h2>
            {maxTrustedPersons > 0 && (
              <p className="text-warmgray-600">
                {trustedPersons.length} von {maxTrustedPersons}
              </p>
            )}
          </div>

          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">
                Aktiv ({activePersons.length})
              </TabsTrigger>
              {inactivePersons.length > 0 && (
                <TabsTrigger value="inactive">
                  Deaktiviert ({inactivePersons.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="active" className="mt-6">
              {activePersons.length > 0 ? (
                <div className="space-y-4">
                  {activePersons.map((person) => (
                    <Card key={person.id} className={`border-l-4 ${
                      userTier.id === 'premium' ? 'border-l-green-500' :
                      userTier.id === 'basic' ? 'border-l-blue-500' : 'border-l-warmgray-300'
                    }`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-sage-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-warmgray-900">{person.name}</h3>
                                <InfoBadge type={userTier.id} variant="compact" />
                              </div>
                              <p className="text-sm text-warmgray-600">{person.relationship}</p>

                              <div className="flex items-center gap-4 mt-2 text-sm text-warmgray-500">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  {person.email}
                                </span>
                                {person.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {person.phone}
                                  </span>
                                )}
                              </div>

                              {person.notes && (
                                <p className="text-sm text-warmgray-500 mt-2 italic">
                                  {person.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(!person.invitation_status || person.invitation_status === 'pending') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendInvite(person.id)}
                                title="Einladung senden"
                                className="text-sage-600 hover:text-sage-700"
                              >
                                <Send className="w-4 h-4 mr-1" />
                                Einladen
                              </Button>
                            )}
                            {person.invitation_status === 'sent' && (
                              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                Einladung gesendet
                              </span>
                            )}
                            {person.invitation_status === 'accepted' && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Verbunden
                              </span>
                            )}
                            {person.invitation_status === 'accepted' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateRelationshipKey(person)}
                                disabled={isGeneratingRk === person.id}
                                className="text-sage-600 hover:text-sage-700"
                              >
                                {isGeneratingRk === person.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    Zugriffslink
                                  </>
                                ) : (
                                  <>
                                    <Key className="w-4 h-4 mr-1" />
                                    Zugriffslink
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(person)}
                              title="Bearbeiten"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(person)}
                              title="Deaktivieren"
                            >
                              <XCircle className="w-4 h-4 text-warmgray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(person.id)}
                              title="Löschen"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
                    <p className="text-warmgray-600">
                      Keine aktiven Vertrauenspersonen
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {inactivePersons.length > 0 && (
              <TabsContent value="inactive" className="mt-6">
                <div className="space-y-4">
                  {inactivePersons.map((person) => (
                    <Card key={person.id} className="opacity-60">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-warmgray-100 flex items-center justify-center flex-shrink-0">
                              <Users className="w-6 h-6 text-warmgray-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-warmgray-700">{person.name}</h3>
                              <p className="text-sm text-warmgray-500">{person.relationship}</p>
                              <p className="text-sm text-warmgray-500 mt-1">{person.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(person)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Aktivieren
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(person.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

          {trustedPersons.length === 0 && maxTrustedPersons > 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-warmgray-900 mb-2">
                  Noch keine Vertrauenspersonen
                </h3>
                <p className="text-warmgray-600 mb-6 max-w-md mx-auto">
                  Wählen Sie oben eine der Optionen, um Ihre Dokumente mit einer vertrauten Person zu teilen.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Familie Tab Content */}
        <TabsContent value="familie" className="space-y-4 sm:space-y-6 mt-6">
          {isFamilyLoading ? (
            <div className="flex items-center justify-center py-12" aria-live="polite">
              <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {/* Bulk share button */}
              <div className="flex items-center justify-between">
                <Button onClick={() => setIsBulkShareOpen(true)} className="bg-sage-600 hover:bg-sage-700">
                  <Share2 className="w-4 h-4 mr-2" />
                  Dokumente teilen
                </Button>
              </div>

              {/* Header */}
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-warmgray-900">
                  Familien-Übersicht
                </h2>
                <p className="text-sm sm:text-base text-warmgray-600 mt-1">
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
                      <Download className="w-6 h-6 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
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
                      <Eye className="w-6 h-6 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" aria-hidden="true" />
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
                      <Lock className="w-6 h-6 sm:w-5 sm:h-5 text-warmgray-500 flex-shrink-0" aria-hidden="true" />
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

              {/* Empty State */}
              {familyMembers.length === 0 ? (
                <Card>
                  <CardContent className="pt-12 pb-12 text-center">
                    <Users className="w-16 h-16 text-warmgray-300 mx-auto mb-4" aria-hidden="true" />
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
                        <h3 className="text-lg sm:text-xl font-semibold text-warmgray-900">Zugriff auf Dokumente</h3>
                        <p className="text-warmgray-600 text-sm mt-1">
                          Diese Personen haben Sie als Vertrauensperson hinzugefügt
                        </p>
                      </div>

                      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2" role="list" aria-label="Familienmitglieder mit Zugriff">
                        {accessibleMembers.map((member) => (
                          <Card
                            key={member.id}
                            className={`hover:border-sage-300 transition-colors border-l-4 ${
                              member.tier?.canDownload ? 'border-l-green-500' :
                              member.tier?.viewOnly ? 'border-l-blue-500' : 'border-l-warmgray-300'
                            }`}
                            role="article"
                          >
                            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
                              <div className="flex flex-col gap-4 sm:gap-6">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                                    <User className="w-6 h-6 sm:w-7 sm:h-7 text-sage-600" aria-hidden="true" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold text-warmgray-900 text-base sm:text-lg truncate">{member.name}</h4>
                                      {member.tier && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span
                                              className={`text-xs px-2 py-0.5 sm:py-1 rounded-full ${member.tier.badge} ${member.tier.color} flex items-center gap-1 cursor-help whitespace-nowrap`}
                                              aria-describedby={`tier-desc-${member.id}`}
                                            >
                                              {member.tier.id === 'premium' && <Crown className="w-3 h-3" aria-hidden="true" />}
                                              {member.tier.name}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs" id={`tier-desc-${member.id}`}>
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
                                        <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                        {member.email}
                                      </span>
                                      {member.linkedAt && (
                                        <span className="flex items-center gap-1.5">
                                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                          Verbunden seit {new Date(member.linkedAt).toLocaleDateString('de-DE')}
                                        </span>
                                      )}
                                    </div>
                                    {typeof member.docsCount === 'number' && (
                                      <div className="flex items-center gap-1.5 mt-1 text-xs sm:text-sm text-warmgray-500">
                                        <FileText className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                        {member.docsCount} {member.docsCount === 1 ? 'Dokument' : 'Dokumente'}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                                  {member.tier?.canDownload ? (
                                    <Button
                                      onClick={() => handleDownloadDocuments(member.id, member.name)}
                                      disabled={downloadingFor === member.id}
                                      className="w-full sm:w-auto text-sm sm:text-base min-h-[44px]"
                                      aria-label={`Dokumente von ${member.name} herunterladen`}
                                    >
                                      {downloadingFor === member.id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                                          Wird geladen...
                                        </>
                                      ) : (
                                        <>
                                          <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                                          Dokumente laden
                                        </>
                                      )}
                                    </Button>
                                  ) : member.tier?.viewOnly ? (
                                    <div className="flex flex-col items-stretch sm:items-start gap-1 w-full sm:w-auto">
                                      <Button
                                        onClick={() => handleViewDocuments(member)}
                                        variant="outline"
                                        className="w-full sm:w-auto border-blue-200 text-blue-700 hover:bg-blue-50 text-sm sm:text-base min-h-[44px]"
                                        aria-label={`Dokumente von ${member.name} ansehen`}
                                      >
                                        <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                                        Nur Ansicht
                                      </Button>
                                      <span className="text-xs text-center sm:text-left text-warmgray-500">
                                        Downloads mit Premium verfügbar
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-stretch sm:items-start gap-1 w-full sm:w-auto">
                                      <Button
                                        disabled
                                        variant="outline"
                                        className="w-full sm:w-auto opacity-50 text-sm sm:text-base min-h-[44px]"
                                        aria-label="Zugriff nicht verfügbar"
                                      >
                                        <Lock className="w-4 h-4 mr-2" aria-hidden="true" />
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
                        <h3 className="text-lg sm:text-xl font-semibold text-warmgray-900">Ihre Vertrauenspersonen</h3>
                        <p className="text-warmgray-600 text-sm mt-1">
                          Diese Personen haben Ihre Einladung akzeptiert und können Ihre Dokumente sehen
                        </p>
                      </div>

                      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2" role="list" aria-label="Ihre Vertrauenspersonen">
                        {outgoingMembers.map((member) => (
                          <Card key={member.id} className="opacity-80" role="article">
                            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
                              <div className="flex flex-col gap-4 sm:gap-6">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-warmgray-100 flex items-center justify-center flex-shrink-0">
                                    <User className="w-6 h-6 sm:w-7 sm:h-7 text-warmgray-500" aria-hidden="true" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-semibold text-warmgray-900 text-base sm:text-lg truncate">{member.name}</h4>
                                    <p className="text-warmgray-600 text-sm sm:text-base">{member.relationship}</p>
                                    <div className="mt-1 text-xs sm:text-sm text-warmgray-500 truncate">
                                      <span className="flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                        {member.email}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <span className="text-xs sm:text-sm text-green-600 bg-green-50 px-3 py-2 sm:px-4 sm:py-2 rounded-full flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto border border-green-100">
                                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
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
                            <ArrowRight className="w-6 h-6 sm:w-5 sm:h-5 text-sage-600" aria-hidden="true" />
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

              {/* Aktive Freigaben */}
              {currentUserId && (
                <div className="space-y-4">
                  <h3 className="text-lg sm:text-xl font-semibold text-warmgray-900">Aktive Freigaben</h3>
                  <ActiveSharesList key={sharesVersion} ownerId={currentUserId} />
                </div>
              )}

              {/* Geteilte Dokumente */}
              <div className="space-y-4">
                <h3 className="text-lg sm:text-xl font-semibold text-warmgray-900">Geteilte Dokumente</h3>
                <ReceivedSharesList onRequestVaultUnlock={() => setIsVaultModalOpen(true)} />
              </div>

              {/* Document Viewer Modal */}
              <Dialog open={!!viewingMember} onOpenChange={(open) => !open && closeViewer()}>
                <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] lg:max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-4 lg:p-6">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">
                      Dokumente ansehen
                    </DialogTitle>
                  </DialogHeader>

                  {isLoadingViewer ? (
                    <div className="flex items-center justify-center py-8 sm:py-12" aria-live="polite">
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
          )}
        </TabsContent>
      </Tabs>

      {/* Download Link Dialog */}
      <Dialog open={isDownloadLinkDialogOpen} onOpenChange={setIsDownloadLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {userTier.id === 'premium' ? (
                <>
                  <Link2 className="w-5 h-5 text-sage-600" />
                  Einmal-Download-Link erstellen
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 text-sage-600" />
                  Ansichts-Link erstellen
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {userTier.id === 'premium' ? (
                <>Erstellen Sie einen Link, mit dem die Person alle Ihre Dokumente als ZIP-Datei herunterladen kann.
                Der Link ist 12 Stunden gültig und kann nur einmal verwendet werden.</>
              ) : (
                <>Erstellen Sie einen Link, mit dem die Person alle Ihre Dokumente im Browser ansehen kann.
                Der Link ist 12 Stunden gültig. Upgrade auf Premium für Download-Links.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {generatedLink ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${generatedLink.linkType === 'view' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className={`w-5 h-5 ${generatedLink.linkType === 'view' ? 'text-blue-600' : 'text-green-600'}`} />
                  <span className={`font-medium ${generatedLink.linkType === 'view' ? 'text-blue-800' : 'text-green-800'}`}>
                    {generatedLink.linkType === 'view' ? 'Ansichts-Link erstellt und per E-Mail gesendet!' : 'Download-Link erstellt und per E-Mail gesendet!'}
                  </span>
                </div>
                <p className={`text-sm ${generatedLink.linkType === 'view' ? 'text-blue-700' : 'text-green-700'}`}>
                  {downloadLinkForm.name} wurde per E-Mail benachrichtigt.
                </p>
              </div>

              {generatedLink.linkType === 'view' && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                  <Eye className="w-4 h-4 inline mr-1" />
                  Mit diesem Link kann die Person Ihre Dokumente nur ansehen, nicht herunterladen.
                  <Link href="/abo" className="block mt-1 text-sage-600 hover:underline">
                    Upgrade auf Premium für Download-Links
                  </Link>
                </div>
              )}

              <div className="space-y-2">
                <Label>{generatedLink.linkType === 'view' ? 'Ansichts-Link' : 'Download-Link'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink.url}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyLinkToClipboard}
                    title="Link kopieren"
                  >
                    {linkCopied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-warmgray-500">
                Gültig bis: {new Date(generatedLink.expiresAt).toLocaleDateString('de-DE')}{' '}
                {new Date(generatedLink.expiresAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>

              <DialogFooter>
                <Button onClick={() => setIsDownloadLinkDialogOpen(false)}>
                  Schließen
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="dl-name">Name des Empfängers *</Label>
                  <Input
                    id="dl-name"
                    value={downloadLinkForm.name}
                    onChange={(e) => setDownloadLinkForm({ ...downloadLinkForm, name: e.target.value })}
                    placeholder="Max Mustermann"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dl-email">E-Mail-Adresse *</Label>
                  <Input
                    id="dl-email"
                    type="email"
                    value={downloadLinkForm.email}
                    onChange={(e) => setDownloadLinkForm({ ...downloadLinkForm, email: e.target.value })}
                    placeholder="max@beispiel.de"
                  />
                  <p className="text-xs text-warmgray-500">
                    Der Link wird automatisch an diese E-Mail-Adresse gesendet.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDownloadLinkDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleGenerateDownloadLink} disabled={isGeneratingLink}>
                  {isGeneratingLink ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Erstellen...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Link erstellen
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Person Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPerson ? 'Person bearbeiten' : 'Person zur Familien-Übersicht einladen'}
            </DialogTitle>
            <DialogDescription>
              {editingPerson
                ? 'Aktualisieren Sie die Daten dieser Person.'
                : 'Laden Sie eine Person ein, die dann Zugriff auf Ihre Dokumente in der Familien-Übersicht hat.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Max Mustermann"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="max@beispiel.de"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefonnummer</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+49 123 456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationship">Beziehung *</Label>
              <Input
                id="relationship"
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                placeholder="z.B. Sohn, Tochter, Ehepartner"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notizen (optional)</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Zusätzliche Informationen..."
              />
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

      {rkDialogOpen && rkShareUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-warmgray-100">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 text-sage-700" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-warmgray-900">Zugriffslink erstellt</h3>
                  <p className="text-sm text-warmgray-600">
                    Teilen Sie diesen Link sicher mit der Vertrauensperson.
                  </p>
                </div>
              </div>

              <div className="bg-warmgray-50 border border-warmgray-100 rounded-lg p-3 font-mono text-xs sm:text-sm text-warmgray-700 break-all">
                {rkShareUrl}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs sm:text-sm">
                Bewahren Sie diesen Link vertraulich auf. Jeder mit dem Link kann auf Ihre freigegebenen Dokumente zugreifen.
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(rkShareUrl)
                    setRkLinkCopied(true)
                    setTimeout(() => setRkLinkCopied(false), 2000)
                  }}
                  className="flex-1 justify-center"
                >
                  {rkLinkCopied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Link kopieren
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRkDialogOpen(false)
                    setRkShareUrl(null)
                  }}
                  className="flex-1 justify-center"
                >
                  Schließen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <VaultUnlockModal isOpen={isVaultModalOpen} onClose={() => setIsVaultModalOpen(false)} />

      <BulkShareDialog
        documents={sharingDocuments}
        trustedPersons={trustedPersons.filter(tp => tp.linked_user_id !== null)}
        isOpen={isBulkShareOpen}
        onClose={() => setIsBulkShareOpen(false)}
        onSuccess={() => { setIsBulkShareOpen(false); setSharesVersion(v => v + 1) }}
        onRequestVaultUnlock={() => setIsVaultModalOpen(true)}
      />
    </div>
    </TooltipProvider>
  )
}
