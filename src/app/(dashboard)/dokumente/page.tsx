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
  Church,
  MoveRight,
  Check,
  X
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
  const [currentFolder, setCurrentFolder] = useState<Subcategory | null>(null)

  // New subcategory creation
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [isCreatingFolderInGrid, setIsCreatingFolderInGrid] = useState(false)
  const [newFolderCategory, setNewFolderCategory] = useState<DocumentCategory | null>(null)

  // Selection & Move state
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [isCreatingFolderInMove, setIsCreatingFolderInMove] = useState(false)
  const [newFolderNameInMove, setNewFolderNameInMove] = useState('')

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

  // Create folder directly from grid (without opening upload dialog)
  const handleCreateFolderInGrid = async () => {
    if (!newSubcategoryName.trim() || !newFolderCategory) return

    // Check subcategory limit
    if (!canPerformAction(userTier, 'addSubcategory', subcategories.length)) {
      alert(`Unterordner-Limit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxSubcategories} Unterordner.`)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('subcategories')
      .insert({
        user_id: user.id,
        parent_category: newFolderCategory,
        name: newSubcategoryName.trim(),
        icon: 'folder'
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        alert('Ein Ordner mit diesem Namen existiert bereits in dieser Kategorie.')
      } else {
        alert('Fehler beim Erstellen des Ordners.')
      }
      return
    }

    if (data) {
      setSubcategories(prev => [...prev, data as Subcategory])
      setNewSubcategoryName('')
      setIsCreatingFolderInGrid(false)
      setNewFolderCategory(null)
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

  // Selection handlers
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(docId)) {
        newSet.delete(docId)
      } else {
        newSet.add(docId)
      }
      return newSet
    })
  }

  const selectAllInCategory = (category: DocumentCategory) => {
    const categoryDocs = documents.filter(d => d.category === category)
    setSelectedDocuments(new Set(categoryDocs.map(d => d.id)))
  }

  const clearSelection = () => {
    setSelectedDocuments(new Set())
  }

  // Move handlers
  const openMoveDialog = (docIds?: string[]) => {
    if (docIds) {
      setSelectedDocuments(new Set(docIds))
    }
    setMoveTargetFolder(null)
    setIsCreatingFolderInMove(false)
    setNewFolderNameInMove('')
    setIsMoveDialogOpen(true)
  }

  const handleMoveDocuments = async () => {
    if (selectedDocuments.size === 0) return

    setIsMoving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // If creating new folder first
      let targetFolderId = moveTargetFolder
      if (isCreatingFolderInMove && newFolderNameInMove.trim()) {
        // Get category from first selected document
        const firstDocId = Array.from(selectedDocuments)[0]
        const firstDoc = documents.find(d => d.id === firstDocId)
        if (!firstDoc) return

        const { data: newFolder, error: folderError } = await supabase
          .from('subcategories')
          .insert({
            user_id: user.id,
            parent_category: firstDoc.category,
            name: newFolderNameInMove.trim(),
            icon: 'folder'
          })
          .select()
          .single()

        if (folderError) {
          alert('Fehler beim Erstellen des Ordners: ' + folderError.message)
          setIsMoving(false)
          return
        }

        targetFolderId = newFolder.id
        setSubcategories(prev => [...prev, newFolder as Subcategory])
      }

      // Move all selected documents
      const docIds = Array.from(selectedDocuments)
      const { error } = await supabase
        .from('documents')
        .update({ subcategory_id: targetFolderId })
        .in('id', docIds)

      if (error) {
        alert('Fehler beim Verschieben: ' + error.message)
      } else {
        // Update local state
        setDocuments(prev => prev.map(doc =>
          selectedDocuments.has(doc.id)
            ? { ...doc, subcategory_id: targetFolderId }
            : doc
        ))
        setIsMoveDialogOpen(false)
        clearSelection()
      }
    } catch (error) {
      console.error('Move error:', error)
      alert('Fehler beim Verschieben der Dokumente')
    } finally {
      setIsMoving(false)
    }
  }

  // Get available folders for move (same category as selected docs)
  const getAvailableFoldersForMove = () => {
    if (selectedDocuments.size === 0) return []
    const firstDocId = Array.from(selectedDocuments)[0]
    const firstDoc = documents.find(d => d.id === firstDocId)
    if (!firstDoc) return []
    return subcategories.filter(s => s.parent_category === firstDoc.category)
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
    const isSelected = selectedDocuments.has(doc.id)

    return (
      <div key={doc.id} className={`document-item group ${isSelected ? 'bg-sage-50 border-sage-300' : ''}`}>
        {/* Checkbox */}
        <button
          onClick={() => toggleDocumentSelection(doc.id)}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected
              ? 'bg-sage-500 border-sage-500 text-white'
              : 'border-warmgray-300 hover:border-sage-400'
          }`}
        >
          {isSelected && <Check className="w-4 h-4" />}
        </button>

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
            onClick={() => openMoveDialog([doc.id])}
            title="Verschieben"
          >
            <MoveRight className="w-5 h-5" />
          </Button>
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

  // Render folder grid for a category (shows all subcategories as folders)
  const renderFolderGrid = (category: DocumentCategory) => {
    const categorySubcategories = getSubcategoriesForCategory(category)
    const uncategorizedDocs = getUncategorizedDocuments(category)
    const categoryInfo = DOCUMENT_CATEGORIES[category]
    const Icon = iconMap[categoryInfo.icon] || FileText

    return (
      <div className="space-y-6">
        {/* Action bar */}
        <div className="flex justify-end">
          <Button onClick={() => openUploadDialog(category)}>
            <Upload className="mr-2 h-4 w-4" />
            Dokument hochladen
          </Button>
        </div>

        {/* Folder Grid - Always show to allow creating folders */}
        <div>
          <h3 className="text-sm font-medium text-warmgray-600 mb-3">Unterordner</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categorySubcategories.map(subcategory => {
              const docCount = getDocumentsForSubcategory(subcategory.id).length
              return (
                <button
                  key={subcategory.id}
                  onClick={() => setCurrentFolder(subcategory)}
                  className="p-4 rounded-lg border-2 border-warmgray-200 hover:border-sage-400 hover:bg-sage-50 transition-all text-left group"
                >
                  <div className="flex items-center justify-center mb-3">
                    <Folder className="w-12 h-12 text-sage-500 group-hover:text-sage-600 transition-colors" />
                  </div>
                  <p className="font-medium text-warmgray-800 text-center truncate">{subcategory.name}</p>
                  <p className="text-xs text-warmgray-500 text-center mt-1">
                    {docCount} Dokument{docCount !== 1 ? 'e' : ''}
                  </p>
                </button>
              )
            })}
            {/* Add new folder - inline input or button */}
            {isCreatingFolderInGrid && newFolderCategory === category ? (
              <div className="p-4 rounded-lg border-2 border-sage-400 bg-sage-50">
                <div className="flex items-center justify-center mb-3">
                  <FolderPlus className="w-10 h-10 text-sage-500" />
                </div>
                <Input
                  placeholder="Ordnername"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCreateFolderInGrid()
                    } else if (e.key === 'Escape') {
                      setIsCreatingFolderInGrid(false)
                      setNewFolderCategory(null)
                      setNewSubcategoryName('')
                    }
                  }}
                  autoFocus
                  className="text-center mb-2"
                />
                <div className="flex gap-1">
                  <Button size="sm" className="flex-1" onClick={handleCreateFolderInGrid} disabled={!newSubcategoryName.trim()}>
                    Erstellen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsCreatingFolderInGrid(false)
                      setNewFolderCategory(null)
                      setNewSubcategoryName('')
                    }}
                  >
                    <ChevronRight className="w-4 h-4 rotate-45" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsCreatingFolderInGrid(true)
                  setNewFolderCategory(category)
                  setNewSubcategoryName('')
                }}
                className="p-4 rounded-lg border-2 border-dashed border-warmgray-300 hover:border-sage-400 hover:bg-sage-50 transition-all text-center group"
              >
                <div className="flex items-center justify-center mb-3">
                  <FolderPlus className="w-12 h-12 text-warmgray-400 group-hover:text-sage-500 transition-colors" />
                </div>
                <p className="font-medium text-warmgray-500 group-hover:text-sage-600">Neuer Ordner</p>
              </button>
            )}
          </div>
        </div>

        {/* Documents without folder */}
        {uncategorizedDocs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-warmgray-600 mb-3">
              Dokumente ohne Ordner
            </h3>
            <div className="space-y-2">
              {uncategorizedDocs.map(renderDocumentItem)}
            </div>
          </div>
        )}

        {/* Empty state - only when no folders AND no documents */}
        {categorySubcategories.length === 0 && uncategorizedDocs.length === 0 && (
          <div className="text-center py-4 text-warmgray-500">
            <p>Noch keine Dokumente in {categoryInfo.name}</p>
            <p className="text-sm mt-1">Erstelle einen Ordner oben oder lade direkt ein Dokument hoch.</p>
          </div>
        )}
      </div>
    )
  }

  // Render folder content (documents inside a specific folder)
  const renderFolderContent = (folder: Subcategory) => {
    const folderDocs = getDocumentsForSubcategory(folder.id)
    const categoryInfo = DOCUMENT_CATEGORIES[folder.parent_category]

    return (
      <div className="space-y-4">
        {/* Breadcrumb navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentFolder(null)}
              className="text-sage-600 hover:text-sage-700 -ml-2"
            >
              <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
              {categoryInfo.name}
            </Button>
            <ChevronRight className="w-4 h-4 text-warmgray-400" />
            <span className="flex items-center gap-2 text-warmgray-800 font-medium">
              <FolderOpen className="w-4 h-4 text-sage-600" />
              {folder.name}
            </span>
          </div>

          {/* Upload button for this folder */}
          <Button
            size="sm"
            onClick={() => {
              setUploadCategory(folder.parent_category)
              setUploadSubcategory(folder.id)
              setIsUploadOpen(true)
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            In "{folder.name}" hochladen
          </Button>
        </div>

        {/* Documents in folder */}
        {folderDocs.length > 0 ? (
          <div className="space-y-2">
            {folderDocs.map(renderDocumentItem)}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-warmgray-200 rounded-lg">
            <Folder className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
            <h3 className="text-warmgray-700 font-medium mb-2">Dieser Ordner ist leer</h3>
            <p className="text-warmgray-500 text-sm mb-4">
              Laden Sie ein Dokument hoch, um es hier zu speichern
            </p>
            <Button
              onClick={() => {
                setUploadCategory(folder.parent_category)
                setUploadSubcategory(folder.id)
                setIsUploadOpen(true)
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Dokument hochladen
            </Button>
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
        onValueChange={(val) => {
          setSelectedCategory(val === 'all' ? null : val as DocumentCategory)
          setCurrentFolder(null) // Reset folder when changing category
        }}
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
            ) : currentFolder && currentFolder.parent_category === key ? (
              // Show folder contents when a folder is selected
              renderFolderContent(currentFolder)
            ) : (
              // Show folder grid for the category
              renderFolderGrid(key as DocumentCategory)
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
                onClick={() => {
                  setSelectedCategory(key as DocumentCategory)
                  setCurrentFolder(null)
                }}
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

            {/* Subcategory Selection - Dropdown */}
            {uploadCategory && (
              <div className="space-y-2">
                <Label>Unterordner (optional)</Label>
                <div className="space-y-2">
                  <select
                    value={uploadSubcategory || '_none'}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === '_new') {
                        setIsCreatingSubcategory(true)
                        setUploadSubcategory(null)
                      } else if (value === '_none') {
                        setUploadSubcategory(null)
                        setIsCreatingSubcategory(false)
                      } else {
                        setUploadSubcategory(value)
                        setIsCreatingSubcategory(false)
                      }
                    }}
                    className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  >
                    <option value="_none">Kein Unterordner</option>
                    {getCategorySubcategoriesForUpload().map(sub => (
                      <option key={sub.id} value={sub.id}>
                        📁 {sub.name}
                      </option>
                    ))}
                    <option value="_new">+ Neuen Unterordner erstellen...</option>
                  </select>

                  {/* Create new subcategory inline */}
                  {isCreatingSubcategory && (
                    <div className="flex gap-2 mt-2">
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
                        autoFocus
                      />
                      <Button size="sm" onClick={handleCreateSubcategory} disabled={!newSubcategoryName.trim()}>
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

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDocuments.size === 1 ? 'Dokument verschieben' : `${selectedDocuments.size} Dokumente verschieben`}
            </DialogTitle>
            <DialogDescription>
              Wählen Sie einen Zielordner oder erstellen Sie einen neuen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing folders */}
            <div className="space-y-2">
              <Label>Zielordner</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {/* Remove from folder option */}
                <button
                  onClick={() => {
                    setMoveTargetFolder(null)
                    setIsCreatingFolderInMove(false)
                  }}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${
                    moveTargetFolder === null && !isCreatingFolderInMove
                      ? 'border-sage-500 bg-sage-50'
                      : 'border-warmgray-200 hover:border-warmgray-400'
                  }`}
                >
                  <X className="w-5 h-5 text-warmgray-500" />
                  <span className="text-sm">Kein Ordner (aus Ordner entfernen)</span>
                </button>

                {/* Existing folders for this category */}
                {getAvailableFoldersForMove().map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setMoveTargetFolder(folder.id)
                      setIsCreatingFolderInMove(false)
                    }}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${
                      moveTargetFolder === folder.id
                        ? 'border-sage-500 bg-sage-50'
                        : 'border-warmgray-200 hover:border-warmgray-400'
                    }`}
                  >
                    <Folder className="w-5 h-5 text-sage-500" />
                    <span className="text-sm font-medium">{folder.name}</span>
                  </button>
                ))}

                {/* Create new folder option */}
                <button
                  onClick={() => {
                    setIsCreatingFolderInMove(true)
                    setMoveTargetFolder(null)
                  }}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${
                    isCreatingFolderInMove
                      ? 'border-sage-500 bg-sage-50'
                      : 'border-dashed border-warmgray-300 hover:border-sage-400'
                  }`}
                >
                  <FolderPlus className="w-5 h-5 text-warmgray-400" />
                  <span className="text-sm">Neuen Ordner erstellen...</span>
                </button>
              </div>
            </div>

            {/* New folder name input */}
            {isCreatingFolderInMove && (
              <div className="space-y-2">
                <Label>Name des neuen Ordners</Label>
                <Input
                  placeholder="Ordnername eingeben"
                  value={newFolderNameInMove}
                  onChange={(e) => setNewFolderNameInMove(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleMoveDocuments}
              disabled={isMoving || (isCreatingFolderInMove && !newFolderNameInMove.trim())}
            >
              {isMoving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verschieben...
                </>
              ) : (
                <>
                  <MoveRight className="mr-2 h-4 w-4" />
                  Verschieben
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Bar - Fixed at bottom when documents selected */}
      {selectedDocuments.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-warmgray-900 text-white rounded-lg shadow-xl px-6 py-4 flex items-center gap-6 z-50">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-sage-400" />
            <span className="font-medium">{selectedDocuments.size} ausgewählt</span>
          </div>
          <div className="h-6 w-px bg-warmgray-700" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-warmgray-800"
              onClick={() => openMoveDialog()}
            >
              <MoveRight className="mr-2 h-4 w-4" />
              Verschieben
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-warmgray-800"
              onClick={clearSelection}
            >
              <X className="mr-2 h-4 w-4" />
              Auswahl aufheben
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
