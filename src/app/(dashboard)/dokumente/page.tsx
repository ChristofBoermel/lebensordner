'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { DatePicker } from '@/components/ui/date-picker'
import { FileUpload } from '@/components/ui/file-upload'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentPreview } from '@/components/ui/document-preview'
import {
  User,
  Wallet,
  Shield,
  Home,
  HeartPulse,
  FileText,
  Landmark,
  Upload,
  File,
  Trash2,
  Download,
  Loader2,
  Search,
  Eye,
  AlertCircle,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  Briefcase,
  Church
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory, type Document, type Subcategory } from '@/types/database'
import { formatFileSize, formatDate } from '@/lib/utils'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'
import { SUBSCRIPTION_TIERS, getTierFromSubscription, canUploadFile, canPerformAction, type TierConfig } from '@/lib/subscription-tiers'
import Link from 'next/link'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  wallet: Wallet,
  shield: Shield,
  home: Home,
  'heart-pulse': HeartPulse,
  'file-text': FileText,
  landmark: Landmark,
  folder: Folder,
  users: Users,
  briefcase: Briefcase,
  church: Church,
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export default function DocumentsPage() {
  const searchParams = useSearchParams()
  const initialCategory = searchParams.get('kategorie') as DocumentCategory | null
  const shouldOpenUpload = searchParams.get('upload') === 'true'

  const [documents, setDocuments] = useState<Document[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(initialCategory)
  const [isUploadOpen, setIsUploadOpen] = useState(shouldOpenUpload)
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory | null>(initialCategory)
  const [uploadSubcategory, setUploadSubcategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [storageUsed, setStorageUsed] = useState(0)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())

  // New subcategory creation
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadExpiryDate, setUploadExpiryDate] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const supabase = createClient()
  const { capture } = usePostHog()

  // Fetch user tier
  useEffect(() => {
    async function fetchTier() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single()

      if (profile) {
        const tier = getTierFromSubscription(profile.subscription_status, null)
        setUserTier(tier)
      }
    }
    fetchTier()
  }, [supabase])

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) as { data: Document[] | null, error: Error | null }

    if (!error && data) {
      setDocuments(data)
      const totalSize = data.reduce((sum, doc) => sum + doc.file_size, 0)
      setStorageUsed(totalSize)
    }
    setIsLoading(false)
  }, [supabase])

  const fetchSubcategories = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (!error && data) {
      setSubcategories(data as Subcategory[])
    }
  }, [supabase])

  useEffect(() => {
    fetchDocuments()
    fetchSubcategories()
  }, [fetchDocuments, fetchSubcategories])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('Die Datei ist zu groß. Maximale Größe: 25 MB')
      return
    }

    // Check storage limit based on user's tier
    const storageUsedMB = storageUsed / (1024 * 1024)
    const fileSizeMB = file.size / (1024 * 1024)
    const storageCheck = canUploadFile(userTier, storageUsedMB, fileSizeMB)

    if (!storageCheck.allowed) {
      setUploadError(storageCheck.reason || 'Speicherlimit erreicht.')
      return
    }

    // Check document count limit
    if (userTier.limits.maxDocuments !== -1 && documents.length >= userTier.limits.maxDocuments) {
      setUploadError(`Dokumentenlimit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxDocuments} Dokumente. Upgraden Sie für mehr Dokumente.`)
      return
    }

    setUploadFile(file)
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
    setUploadError(null)
  }

  const handleCreateSubcategory = async () => {
    if (!newSubcategoryName.trim() || !uploadCategory) return

    // Check subcategory limit
    if (!canPerformAction(userTier, 'addSubcategory', subcategories.length)) {
      setUploadError(`Unterordner-Limit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxSubcategories} Unterordner. Upgraden Sie für mehr.`)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('subcategories')
      .insert({
        user_id: user.id,
        parent_category: uploadCategory,
        name: newSubcategoryName.trim(),
        icon: 'folder'
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // unique violation
        setUploadError('Ein Unterordner mit diesem Namen existiert bereits in dieser Kategorie.')
      } else {
        setUploadError('Fehler beim Erstellen des Unterordners.')
      }
      return
    }

    if (data) {
      setSubcategories(prev => [...prev, data as Subcategory])
      setUploadSubcategory(data.id)
      setNewSubcategoryName('')
      setIsCreatingSubcategory(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadCategory || !uploadTitle) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // Upload file to storage
      const fileExt = uploadFile.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadFile)

      if (uploadError) throw uploadError

      // Create document record with subcategory
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          category: uploadCategory,
          subcategory_id: uploadSubcategory || null,
          title: uploadTitle,
          notes: uploadNotes || null,
          file_name: uploadFile.name,
          file_path: fileName,
          file_size: uploadFile.size,
          file_type: uploadFile.type || 'application/octet-stream',
          expiry_date: uploadExpiryDate || null,
        })

      if (insertError) throw insertError

      // Update storage used in profile
      await supabase
        .from('profiles')
        .update({ storage_used: storageUsed + uploadFile.size })
        .eq('id', user.id)

      // Track successful upload
      capture(ANALYTICS_EVENTS.DOCUMENT_UPLOADED, {
        category: uploadCategory,
        has_subcategory: !!uploadSubcategory,
        file_type: uploadFile.type,
        file_size_kb: Math.round(uploadFile.size / 1024),
      })

      // Reset and refresh
      setUploadFile(null)
      setUploadTitle('')
      setUploadNotes('')
      setUploadExpiryDate('')
      setUploadSubcategory(null)
      setIsUploadOpen(false)
      fetchDocuments()
    } catch (error) {
      capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
        error_type: 'document_upload_failed',
        category: uploadCategory,
      })
      setUploadError('Fehler beim Hochladen. Bitte versuchen Sie es erneut.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm('Möchten Sie dieses Dokument wirklich löschen?')) return

    try {
      // Delete from storage
      await supabase.storage
        .from('documents')
        .remove([doc.file_path])

      // Delete record
      await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)

      // Update storage
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ storage_used: Math.max(0, storageUsed - doc.file_size) })
          .eq('id', user.id)
      }

      fetchDocuments()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handleDownload = async (doc: Document) => {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60)

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const openUploadDialog = (category: DocumentCategory) => {
    setUploadCategory(category)
    setUploadSubcategory(null)
    setIsCreatingSubcategory(false)
    setNewSubcategoryName('')
    setIsUploadOpen(true)
  }

  const toggleSubcategoryExpand = (subcategoryId: string) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId)
      } else {
        newSet.add(subcategoryId)
      }
      return newSet
    })
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = !selectedCategory || doc.category === selectedCategory
    const matchesSearch = !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getDocumentCountForCategory = (category: DocumentCategory) => {
    return documents.filter(d => d.category === category).length
  }

  const getSubcategoriesForCategory = (category: DocumentCategory) => {
    return subcategories.filter(s => s.parent_category === category)
  }

  const getDocumentsForSubcategory = (subcategoryId: string) => {
    return filteredDocuments.filter(d => d.subcategory_id === subcategoryId)
  }

  const getUncategorizedDocuments = (category: DocumentCategory) => {
    return filteredDocuments.filter(d => d.category === category && !d.subcategory_id)
  }

  const getCategorySubcategoriesForUpload = () => {
    if (!uploadCategory) return []
    return subcategories.filter(s => s.parent_category === uploadCategory)
  }

  // Render document item
  const renderDocumentItem = (doc: Document) => {
    const category = DOCUMENT_CATEGORIES[doc.category]
    const Icon = iconMap[category.icon] || FileText
    const subcategory = doc.subcategory_id
      ? subcategories.find(s => s.id === doc.subcategory_id)
      : null

    return (
      <div key={doc.id} className="document-item group">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-sage-50 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-sage-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-warmgray-900 truncate">{doc.title}</p>
            <div className="flex items-center gap-2 text-sm text-warmgray-500">
              <span>{category.name}</span>
              {subcategory && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span>{subcategory.name}</span>
                </>
              )}
              <span>•</span>
              <span>{formatFileSize(doc.file_size)}</span>
              <span>•</span>
              <span>{formatDate(doc.created_at)}</span>
            </div>
            {doc.notes && (
              <p className="text-sm text-warmgray-500 truncate mt-1">{doc.notes}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewDocument(doc)}
            title="Vorschau"
          >
            <Eye className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDownload(doc)}
            title="Herunterladen"
          >
            <Download className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(doc)}
            title="Löschen"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    )
  }

  // Render folder structure for a category
  const renderFolderStructure = (category: DocumentCategory) => {
    const categorySubcategories = getSubcategoriesForCategory(category)
    const uncategorizedDocs = getUncategorizedDocuments(category)

    if (categorySubcategories.length === 0 && uncategorizedDocs.length === 0) {
      return null
    }

    return (
      <div className="space-y-4">
        {/* Subcategory folders */}
        {categorySubcategories.map(subcategory => {
          const subDocs = getDocumentsForSubcategory(subcategory.id)
          const isExpanded = expandedSubcategories.has(subcategory.id)

          if (subDocs.length === 0) return null

          return (
            <div key={subcategory.id} className="border border-warmgray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSubcategoryExpand(subcategory.id)}
                className="w-full flex items-center gap-3 p-4 bg-warmgray-50 hover:bg-warmgray-100 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-warmgray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-warmgray-500" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-5 h-5 text-sage-600" />
                ) : (
                  <Folder className="w-5 h-5 text-sage-600" />
                )}
                <span className="font-medium text-warmgray-800">{subcategory.name}</span>
                <span className="text-sm text-warmgray-500 ml-auto">
                  {subDocs.length} Dokument{subDocs.length !== 1 ? 'e' : ''}
                </span>
              </button>
              {isExpanded && (
                <div className="divide-y divide-warmgray-100">
                  {subDocs.map(renderDocumentItem)}
                </div>
              )}
            </div>
          )
        })}

        {/* Uncategorized documents */}
        {uncategorizedDocs.length > 0 && (
          <div className="space-y-3">
            {categorySubcategories.length > 0 && (
              <p className="text-sm text-warmgray-500 font-medium px-1">Ohne Unterordner</p>
            )}
            {uncategorizedDocs.map(renderDocumentItem)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Dokumente
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Organisieren Sie Ihre wichtigen Unterlagen nach Kategorien und Unterordnern
        </p>
      </div>

      {/* Storage Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-warmgray-600">Speicherplatz verwendet</span>
            <span className="text-sm font-medium text-warmgray-900">
              {formatFileSize(storageUsed)} von {userTier.limits.maxStorageMB >= 1024
                ? `${(userTier.limits.maxStorageMB / 1024).toFixed(0)} GB`
                : `${userTier.limits.maxStorageMB} MB`}
            </span>
          </div>
          <Progress value={(storageUsed / (userTier.limits.maxStorageMB * 1024 * 1024)) * 100} className="h-2" />
          <div className="flex items-center justify-between mt-3 text-sm text-warmgray-500">
            <span>
              {subcategories.length} von {userTier.limits.maxSubcategories === -1 ? '∞' : userTier.limits.maxSubcategories} Unterordnern
            </span>
            <span>
              {documents.length} von {userTier.limits.maxDocuments === -1 ? '∞' : userTier.limits.maxDocuments} Dokumenten
            </span>
          </div>
          {storageUsed / (1024 * 1024) > userTier.limits.maxStorageMB * 0.8 && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Speicherplatz fast voll</p>
                  <p className="text-amber-700">
                    <Link href="/abo" className="underline hover:no-underline">Upgraden Sie</Link> für mehr Speicherplatz.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray-400" />
          <Input
            type="search"
            placeholder="Dokumente durchsuchen..."
            className="pl-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => openUploadDialog(selectedCategory || 'identitaet')}>
          <Upload className="mr-2 h-5 w-5" />
          Dokument hochladen
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={selectedCategory || 'all'}
        onValueChange={(val) => setSelectedCategory(val === 'all' ? null : val as DocumentCategory)}
      >
        <TabsList className="w-full h-auto flex-wrap justify-start bg-transparent gap-2 p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700"
          >
            Alle ({documents.length})
          </TabsTrigger>
          {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => {
            const count = getDocumentCountForCategory(key as DocumentCategory)
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700"
              >
                {category.name} ({count})
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* All categories view */}
        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="space-y-3">
              {filteredDocuments.map(renderDocumentItem)}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-warmgray-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-warmgray-400" />
              </div>
              <h3 className="text-lg font-medium text-warmgray-900 mb-2">
                {searchQuery ? 'Keine Dokumente gefunden' : 'Noch keine Dokumente'}
              </h3>
              <p className="text-warmgray-500 mb-4">
                {searchQuery
                  ? 'Versuchen Sie eine andere Suche'
                  : 'Laden Sie Ihr erstes Dokument hoch, um zu beginnen'}
              </p>
              {!searchQuery && (
                <Button onClick={() => openUploadDialog('identitaet')}>
                  <Upload className="mr-2 h-5 w-5" />
                  Dokument hochladen
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Individual category views with folder structure */}
        {Object.entries(DOCUMENT_CATEGORIES).map(([key]) => (
          <TabsContent key={key} value={key} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
              </div>
            ) : (
              renderFolderStructure(key as DocumentCategory) || (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-warmgray-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-warmgray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-warmgray-900 mb-2">
                    Noch keine Dokumente in dieser Kategorie
                  </h3>
                  <p className="text-warmgray-500 mb-4">
                    Laden Sie ein Dokument hoch, um zu beginnen
                  </p>
                  <Button onClick={() => openUploadDialog(key as DocumentCategory)}>
                    <Upload className="mr-2 h-5 w-5" />
                    Dokument hochladen
                  </Button>
                </div>
              )
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Category Cards (when no category is selected) */}
      {!selectedCategory && !searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => {
            const Icon = iconMap[category.icon] || FileText
            const count = getDocumentCountForCategory(key as DocumentCategory)
            const categorySubcats = getSubcategoriesForCategory(key as DocumentCategory)
            return (
              <Card
                key={key}
                className="cursor-pointer hover:border-sage-300 hover:shadow-md transition-all"
                onClick={() => setSelectedCategory(key as DocumentCategory)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-lg bg-sage-100 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-sage-600" />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        openUploadDialog(key as DocumentCategory)
                      }}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-warmgray-600">
                    <span className="font-semibold text-sage-600">{count}</span> Dokument{count !== 1 ? 'e' : ''}
                    {categorySubcats.length > 0 && (
                      <span className="text-warmgray-500"> in {categorySubcats.length} Unterordner{categorySubcats.length !== 1 ? 'n' : ''}</span>
                    )}
                  </p>
                  <p className="text-xs text-warmgray-500 mt-2">
                    z.B. {category.examples.slice(0, 3).join(', ')}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dokument hochladen</DialogTitle>
            <DialogDescription>
              Wählen Sie eine Kategorie, optional einen Unterordner, und laden Sie Ihre Datei hoch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {uploadError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {uploadError}
              </div>
            )}

            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setUploadCategory(key as DocumentCategory)
                      setUploadSubcategory(null)
                      setIsCreatingSubcategory(false)
                    }}
                    className={`p-3 text-left rounded-lg border-2 transition-colors ${
                      uploadCategory === key
                        ? 'border-sage-500 bg-sage-50 text-sage-800'
                        : 'border-warmgray-200 hover:border-warmgray-400 text-warmgray-700'
                    }`}
                  >
                    <span className="text-sm font-medium">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subcategory Selection */}
            {uploadCategory && (
              <div className="space-y-2">
                <Label>Unterordner (optional)</Label>
                <div className="space-y-2">
                  {/* Existing subcategories */}
                  {getCategorySubcategoriesForUpload().length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setUploadSubcategory(null)}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          !uploadSubcategory && !isCreatingSubcategory
                            ? 'border-sage-500 bg-sage-50 text-sage-800'
                            : 'border-warmgray-200 hover:border-warmgray-400 text-warmgray-700'
                        }`}
                      >
                        Kein Unterordner
                      </button>
                      {getCategorySubcategoriesForUpload().map(sub => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setUploadSubcategory(sub.id)
                            setIsCreatingSubcategory(false)
                          }}
                          className={`px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-2 ${
                            uploadSubcategory === sub.id
                              ? 'border-sage-500 bg-sage-50 text-sage-800'
                              : 'border-warmgray-200 hover:border-warmgray-400 text-warmgray-700'
                          }`}
                        >
                          <Folder className="w-4 h-4" />
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Create new subcategory */}
                  {isCreatingSubcategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Name des Unterordners"
                        value={newSubcategoryName}
                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleCreateSubcategory()
                          }
                        }}
                      />
                      <Button size="sm" onClick={handleCreateSubcategory}>
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsCreatingSubcategory(false)
                          setNewSubcategoryName('')
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreatingSubcategory(true)}
                      className="w-full"
                    >
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Neuen Unterordner erstellen
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* File Selection - Drag & Drop */}
            <div className="space-y-2">
              <Label>Datei</Label>
              <FileUpload
                selectedFile={uploadFile}
                onFileSelect={(file) => setUploadFile(file)}
                onClear={() => setUploadFile(null)}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                placeholder="z.B. Personalausweis"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notiz (optional)</Label>
              <Input
                id="notes"
                placeholder="z.B. Gültig bis 2028"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label>Ablaufdatum (optional)</Label>
              <DatePicker
                value={uploadExpiryDate}
                onChange={setUploadExpiryDate}
                minDate={new Date().toISOString().split('T')[0]}
                placeholder="Ablaufdatum wählen"
              />
              <p className="text-xs text-warmgray-500">
                Sie werden automatisch erinnert, wenn das Dokument bald abläuft
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || !uploadCategory || !uploadTitle || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Hochladen...
                </>
              ) : (
                'Hochladen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview */}
      <DocumentPreview
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
      />
    </div>
  )
}
