'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DocumentListItem } from './components/DocumentListItem'
import { FolderCard } from './components/FolderCard'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  MoreVertical,
  Check,
  X,
  Pencil,
  PlusCircle,
  Tag,
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory, type Document, type Subcategory, type CustomCategory } from '@/types/database'
import { formatFileSize, formatDate } from '@/lib/utils'
import { usePostHog, ANALYTICS_EVENTS } from '@/lib/posthog'
import { SUBSCRIPTION_TIERS, getTierFromSubscription, canUploadFile, canPerformAction, type TierConfig } from '@/lib/subscription-tiers'
import { UpgradeNudge, UpgradeModal } from '@/components/upgrade'
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

const categoryColorMap: Record<string, string> = {
  identitaet: 'bg-blue-100 text-blue-600',
  finanzen: 'bg-emerald-100 text-emerald-600',
  versicherungen: 'bg-amber-100 text-amber-600',
  wohnen: 'bg-orange-100 text-orange-600',
  gesundheit: 'bg-red-100 text-red-600',
  vertraege: 'bg-purple-100 text-purple-600',
  rente: 'bg-indigo-100 text-indigo-600',
  familie: 'bg-pink-100 text-pink-600',
  arbeit: 'bg-cyan-100 text-cyan-600',
  religion: 'bg-violet-100 text-violet-600',
  sonstiges: 'bg-warmgray-100 text-warmgray-600',
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export default function DocumentsPage() {
  const searchParams = useSearchParams()
  const initialCategory = searchParams.get('kategorie') as DocumentCategory | null
  const shouldOpenUpload = searchParams.get('upload') === 'true'
  const highlightDocumentId = searchParams.get('highlight')

  const [documents, setDocuments] = useState<Document[]>([])
  const [highlightedDoc, setHighlightedDoc] = useState<string | null>(highlightDocumentId)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(initialCategory)
  const [activeTab, setActiveTab] = useState<string>(initialCategory || 'overview')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [isUploadOpen, setIsUploadOpen] = useState(shouldOpenUpload)
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory | null>(initialCategory)
  const [uploadSubcategory, setUploadSubcategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [storageUsed, setStorageUsed] = useState(0)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())
  const [currentFolder, setCurrentFolder] = useState<Subcategory | null>(null)

  // Custom categories
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [selectedCustomCategory, setSelectedCustomCategory] = useState<string | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  // Upgrade Modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [upgradeModalFeature, setUpgradeModalFeature] = useState<'document' | 'folder' | 'trusted_person' | 'storage' | 'custom_category'>('folder')

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
  const [uploadCustomReminderDays, setUploadCustomReminderDays] = useState<number | null>(null)
  const [uploadCustomCategory, setUploadCustomCategory] = useState<string | null>(null)
  const [uploadReminderWatcher, setUploadReminderWatcher] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Family members for reminder watcher
  interface FamilyMember {
    id: string
    name: string
    email: string
  }
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])

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

  const fetchCustomCategories = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (!error && data) {
      setCustomCategories(data as CustomCategory[])
    }
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
    fetchDocuments()
    fetchSubcategories()
    fetchCustomCategories()
    fetchFamilyMembers()
  }, [fetchDocuments, fetchSubcategories, fetchCustomCategories, fetchFamilyMembers])

  // Handle document highlighting from search
  useEffect(() => {
    if (highlightedDoc && documents.length > 0) {
      // Scroll to the highlighted document after a short delay
      const timer = setTimeout(() => {
        const element = document.getElementById(`doc-${highlightedDoc}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)

      // Clear highlight after 3 seconds
      const clearTimer = setTimeout(() => {
        setHighlightedDoc(null)
      }, 3000)

      return () => {
        clearTimeout(timer)
        clearTimeout(clearTimer)
      }
    }
  }, [highlightedDoc, documents])

  const validateAndSetFile = (file: File) => {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    validateAndSetFile(file)
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
      setUpgradeModalFeature('folder')
      setUpgradeModalOpen(true)
      setIsCreatingFolderInGrid(false)
      setNewFolderCategory(null)
      setNewSubcategoryName('')
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
    if (!uploadFile || !uploadCategory || !uploadTitle.trim()) return

    // Final client-side limit check before attempting upload
    if (userTier.limits.maxDocuments !== -1 && documents.length >= userTier.limits.maxDocuments) {
      setUploadError(`Dokumentenlimit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxDocuments} Dokumente. Upgraden Sie für mehr Dokumente.`)
      return
    }

    setIsUploading(true)
    setUploadError(null)

    setIsUploading(true)
    setUploadError(null)

    try {
      // 1. Upload via Server-Side API
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('path', uploadCategory || 'sonstige') // Use category as path folder
      formData.append('bucket', 'documents')

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json()
        throw new Error(errorData.error || 'Upload fehlgeschlagen')
      }

      const uploadData = await uploadRes.json()
      const { path: filePath, size: fileSize } = uploadData

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // 2. Create document record
      const { data: insertedDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          category: uploadCategory,
          subcategory_id: uploadSubcategory || null,
          custom_category_id: uploadCustomCategory || null,
          title: uploadTitle.trim(),
          notes: uploadNotes || null,
          file_name: uploadFile.name,
          file_path: filePath,
          file_size: fileSize,
          file_type: uploadFile.type || 'application/octet-stream',
          expiry_date: uploadExpiryDate || null,
          custom_reminder_days: uploadCustomReminderDays,
          reminder_watcher_id: uploadReminderWatcher || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Send notification to reminder watcher if selected
      if (uploadReminderWatcher && uploadExpiryDate && insertedDoc) {
        const watcher = familyMembers.find(m => m.id === uploadReminderWatcher)
        if (watcher) {
          try {
            await fetch('/api/reminder-watcher/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                documentId: insertedDoc.id,
                documentTitle: uploadTitle,
                category: uploadCategory,
                expiryDate: uploadExpiryDate,
                watcherEmail: watcher.email,
                watcherName: watcher.name,
              })
            })
          } catch (err) {
            console.error('Failed to notify watcher:', err)
          }
        }
      }

      // No need to update profiles storage manually - API handled it.
      // But we should update local state to reflect new usage immediately
      setStorageUsed(prev => prev + fileSize)

      // Optimistic UI Update: Add document to list immediately
      // We need to fetch the subcategory/category details if needed for full display,
      // but simpler is to use what we have and let fetchDocuments catch up.
      // Or just insert it with basic data.
      if (insertedDoc) {
        const optimisticDoc: any = {
          ...insertedDoc,
          subcategory: { name: 'Lade...' }, // Placeholder until refetch
          custom_category: null
        }
        setDocuments(prev => [optimisticDoc, ...prev])
      }

      // Track successful upload
      capture(ANALYTICS_EVENTS.DOCUMENT_UPLOADED, {
        category: uploadCategory,
        has_subcategory: !!uploadSubcategory,
        file_type: uploadFile.type,
        file_size_kb: Math.round(fileSize / 1024),
      })

      // Reset and refresh
      setUploadFile(null)
      setUploadTitle('')
      setUploadNotes('')
      setUploadExpiryDate('')
      setUploadCustomReminderDays(null)
      setUploadSubcategory(null)
      setUploadCustomCategory(null)
      setUploadReminderWatcher(null)
      setIsUploadOpen(false)

      // Fetch in background to ensure consistency
      fetchDocuments()
    } catch (error: any) {
      capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
        error_type: 'document_upload_failed',
        category: uploadCategory,
      })
      // Check for document limit error from server
      const errorObj = error as { message?: string; code?: string }
      if (errorObj?.message?.includes('Document limit') || errorObj?.code === 'check_violation') {
        setUploadError('Dokumentenlimit erreicht. Bitte upgraden Sie für mehr Dokumente.')
        setUpgradeModalFeature('document')
        setUpgradeModalOpen(true)
      } else {
        setUploadError('Fehler beim Hochladen. Bitte versuchen Sie es erneut.')
      }
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

  // Navigate to document logic
  const navigateToDocument = (doc: Document) => {
    // 1. Determine tab and category
    if (doc.custom_category_id) {
      setActiveTab(`custom:${doc.custom_category_id}`)
      setSelectedCustomCategory(doc.custom_category_id)
      setSelectedCategory(null)
    } else {
      setActiveTab(doc.category)
      setSelectedCategory(doc.category)
      setSelectedCustomCategory(null)
    }

    // 2. Open folder if document is in one
    if (doc.subcategory_id) {
      const folder = subcategories.find(s => s.id === doc.subcategory_id)
      if (folder) {
        setCurrentFolder(folder)
      }
    } else {
      setCurrentFolder(null)
    }

    // 3. Highlight and scroll
    setHighlightedDoc(doc.id)
    setTimeout(() => {
      const element = document.getElementById(`doc-${doc.id}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
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

  // Delete folder handler
  const handleDeleteFolder = async (folder: Subcategory, e?: React.MouseEvent) => {
    if (e) e.stopPropagation() // Prevent folder click

    const docsInFolder = documents.filter(d => d.subcategory_id === folder.id)
    const confirmMessage = docsInFolder.length > 0
      ? `Ordner "${folder.name}" mit ${docsInFolder.length} Dokument(en) löschen? Die Dokumente werden nicht gelöscht, sondern nur aus dem Ordner entfernt.`
      : `Ordner "${folder.name}" wirklich löschen?`

    if (!confirm(confirmMessage)) return

    try {
      // First, remove folder reference from all documents in this folder
      if (docsInFolder.length > 0) {
        const { error: updateError } = await supabase
          .from('documents')
          .update({ subcategory_id: null })
          .eq('subcategory_id', folder.id)

        if (updateError) {
          alert('Fehler beim Entfernen der Dokumente aus dem Ordner.')
          return
        }

        // Update local documents state
        setDocuments(prev => prev.map(doc =>
          doc.subcategory_id === folder.id
            ? { ...doc, subcategory_id: null }
            : doc
        ))
      }

      // Delete the folder
      const { error: deleteError } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', folder.id)

      if (deleteError) {
        alert('Fehler beim Löschen des Ordners.')
        return
      }

      // Update local state
      setSubcategories(prev => prev.filter(s => s.id !== folder.id))

      // If we were viewing this folder, go back
      if (currentFolder?.id === folder.id) {
        setCurrentFolder(null)
      }
    } catch (error) {
      console.error('Delete folder error:', error)
      alert('Fehler beim Löschen des Ordners.')
    }
  }

  const openUploadDialog = (category: DocumentCategory | null, customCategoryId?: string) => {
    setUploadCategory(category)
    setUploadCustomCategory(customCategoryId || null)
    setUploadSubcategory(null)
    setIsCreatingSubcategory(false)
    setNewSubcategoryName('')
    setIsUploadOpen(true)
  }

  // Custom category handlers
  const openCategoryDialog = (category?: CustomCategory) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({ name: category.name, description: category.description || '' })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '' })
    }
    setCategoryError(null)
    setIsCategoryDialogOpen(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      setCategoryError('Bitte geben Sie einen Namen ein.')
      return
    }

    setIsSavingCategory(true)
    setCategoryError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      if (editingCategory) {
        // Update existing
        const { error } = await supabase
          .from('custom_categories')
          .update({
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
          })
          .eq('id', editingCategory.id)

        if (error) throw error
      } else {
        // Check limit
        if (!canPerformAction(userTier, 'addCustomCategory', customCategories.length)) {
          setCategoryError(`Kategorie-Limit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxCustomCategories} eigene Kategorien.`)
          setIsSavingCategory(false)
          return
        }

        // Create new
        const { error } = await supabase
          .from('custom_categories')
          .insert({
            user_id: user.id,
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
            icon: 'tag',
          })

        if (error) {
          if (error.code === '23505') {
            setCategoryError('Eine Kategorie mit diesem Namen existiert bereits.')
          } else {
            throw error
          }
          setIsSavingCategory(false)
          return
        }
      }

      setIsCategoryDialogOpen(false)
      fetchCustomCategories()
    } catch (error) {
      console.error('Save category error:', error)
      setCategoryError('Fehler beim Speichern. Bitte versuchen Sie es erneut.')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    const docsInCategory = documents.filter(d => d.custom_category_id === categoryId)
    const confirmMessage = docsInCategory.length > 0
      ? `Diese Kategorie mit ${docsInCategory.length} Dokument(en) löschen? Die Dokumente werden in "Sonstige" verschoben.`
      : 'Diese Kategorie wirklich löschen?'

    if (!confirm(confirmMessage)) return

    try {
      // Move documents to "sonstige" category
      if (docsInCategory.length > 0) {
        await supabase
          .from('documents')
          .update({ custom_category_id: null, category: 'sonstige' as DocumentCategory })
          .eq('custom_category_id', categoryId)
      }

      const { error } = await supabase
        .from('custom_categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error

      // Reset selection if deleted category was selected
      if (selectedCustomCategory === categoryId) {
        setSelectedCustomCategory(null)
        setSelectedCategory(null)
      }

      fetchCustomCategories()
      fetchDocuments()
    } catch (error) {
      console.error('Delete category error:', error)
      alert('Fehler beim Löschen der Kategorie.')
    }
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

  // Pre-process documents for validation and deduplication (as per random_empty_documents.md)
  const validatedDocuments = (() => {
    const seenIds = new Set()
    return documents.filter(doc => {
      // 1. Mandatory title validation
      if (!doc.title || doc.title.trim().length === 0) return false
      // 2. ID deduplication
      if (seenIds.has(doc.id)) return false
      seenIds.add(doc.id)
      return true
    })
  })()

  const filteredDocuments = validatedDocuments.filter(doc => {
    // Check if viewing a custom category
    if (selectedCustomCategory) {
      const matchesCustomCategory = doc.custom_category_id === selectedCustomCategory
      const matchesSearch = !searchQuery ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCustomCategory && matchesSearch
    }

    // Check standard category
    const matchesCategory = !selectedCategory || doc.category === selectedCategory
    // Also filter out documents that have a custom category when viewing standard categories
    const notInCustomCategory = !doc.custom_category_id
    const matchesSearch = !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && (selectedCategory ? notInCustomCategory : true) && matchesSearch
  })

  const getDocumentCountForCategory = (category: DocumentCategory) => {
    return validatedDocuments.filter(d => d.category === category && !d.custom_category_id).length
  }

  const getDocumentCountForCustomCategory = (categoryId: string) => {
    return validatedDocuments.filter(d => d.custom_category_id === categoryId).length
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
    const categoryInfo = DOCUMENT_CATEGORIES[doc.category]
    const subcategory = doc.subcategory_id
      ? subcategories.find(s => s.id === doc.subcategory_id)
      : null

    return (
      <DocumentListItem
        key={doc.id}
        doc={doc}
        categoryInfo={{
          name: categoryInfo.name,
          icon: categoryInfo.icon
        }}
        subcategoryName={subcategory?.name}
        isSelected={selectedDocuments.has(doc.id)}
        isHighlighted={highlightedDoc === doc.id}
        iconMap={iconMap as any}
        onToggleSelection={toggleDocumentSelection}
        onNavigate={navigateToDocument}
        onPreview={setPreviewDocument}
        onDownload={handleDownload}
        onMove={openMoveDialog}
        onDelete={handleDelete}
      />
    )
  }

  // Render folder grid for a category (shows all subcategories as folders)
  const renderFolderGrid = (category: DocumentCategory) => {
    const categorySubcategories = getSubcategoriesForCategory(category)
    const uncategorizedDocs = getUncategorizedDocuments(category)
    const categoryInfo = DOCUMENT_CATEGORIES[category]

    return (
      <div className="space-y-10">
        {/* Action bar - Senior Friendly */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
          <h3 className="text-2xl font-bold text-warmgray-900">
            {categorySubcategories.length > 0 ? 'Unterordner' : 'Dokumente'}
          </h3>
          <Button
            onClick={() => openUploadDialog(category)}
            className="h-[56px] w-full sm:w-auto px-8 text-lg font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <PlusCircle className="mr-3 h-6 w-6" />
            Dokument hinzufügen
          </Button>
        </div>

        {/* Folder Grid - Robust Mobile First */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-1">
          {categorySubcategories.map(subcategory => (
            <FolderCard
              key={subcategory.id}
              subcategory={subcategory}
              docCount={getDocumentsForSubcategory(subcategory.id).length}
              onOpen={setCurrentFolder}
              onDelete={handleDeleteFolder}
            />
          ))}

          {/* Add new folder button */}
          <button
            onClick={() => {
              setIsCreatingFolderInGrid(true)
              setNewFolderCategory(category)
              setNewSubcategoryName('')
            }}
            className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-warmgray-200 bg-white hover:border-sage-400 hover:bg-sage-50/30 transition-all duration-300 min-h-[140px] gap-3 group shadow-sm overflow-hidden"
          >
            <div className="h-14 w-14 rounded-xl bg-warmgray-50 flex items-center justify-center text-warmgray-400 group-hover:bg-sage-100 group-hover:text-sage-600 transition-colors">
              <FolderPlus className="w-8 h-8" />
            </div>
            <span className="font-bold text-lg text-warmgray-600 group-hover:text-sage-800">Ordner erstellen</span>
          </button>
        </div>

        {/* Inline Folder Creation */}
        {isCreatingFolderInGrid && newFolderCategory === category && (
          <div className="mx-1 p-6 rounded-2xl border-2 border-sage-500 bg-white shadow-xl animate-in fade-in slide-in-from-top-4">
            <h4 className="text-lg font-bold text-warmgray-900 mb-4">Neuen Ordner in "{categoryInfo.name}" erstellen</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Name des Ordners (z.B. Kontoauszüge)"
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                autoFocus
                className="flex-1 h-14 text-lg px-5 rounded-xl border-warmgray-200"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateFolderInGrid}
                  disabled={!newSubcategoryName.trim()}
                  className="h-14 px-8 text-lg font-bold flex-1 sm:flex-initial"
                >
                  Erstellen
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingFolderInGrid(false)
                    setNewFolderCategory(null)
                    setNewSubcategoryName('')
                  }}
                  className="h-14 px-6 text-lg font-medium text-warmgray-500 flex-1 sm:flex-initial"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Uncategorized Documents Section */}
        {uncategorizedDocs.length > 0 && (
          <div className="pt-8 border-t border-warmgray-100 px-1">
            <h3 className="text-xl font-bold text-warmgray-800 mb-6 px-1">
              Weitere Dokumente in {categoryInfo.name}
            </h3>
            <div className="space-y-4">
              {uncategorizedDocs.map(renderDocumentItem)}
            </div>
          </div>
        )}

        {/* Empty state - only when no folders AND no documents */}
        {categorySubcategories.length === 0 && uncategorizedDocs.length === 0 && !isCreatingFolderInGrid && (
          <div className="text-center py-20 px-4">
            <div className="w-24 h-24 rounded-full bg-cream-100 flex items-center justify-center mx-auto mb-6 text-sage-300">
              <FolderOpen className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold text-warmgray-900 mb-3">Noch keine Inhalte vorhanden</h3>
            <p className="text-lg text-warmgray-500 mb-10 max-w-sm mx-auto leading-relaxed">
              Klicken Sie auf "Dokument hinzufügen" oder erstellen Sie einen Ordner, um Ihre Unterlagen zu organisieren.
            </p>
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
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Breadcrumb navigation and Upload button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-4 sm:p-6 rounded-2xl border border-warmgray-200 shadow-sm">
          <div className="flex items-center flex-wrap gap-2 text-lg">
            <Button
              variant="ghost"
              onClick={() => setCurrentFolder(null)}
              className="text-sage-600 hover:text-sage-700 -ml-2 h-12 px-4 font-bold text-lg rounded-xl transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180 mr-2 flex-shrink-0 stroke-[3]" />
              {categoryInfo.name}
            </Button>
            <ChevronRight className="w-5 h-5 text-warmgray-300 flex-shrink-0" />
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 text-warmgray-900 font-bold">
                <FolderOpen className="w-6 h-6 text-sage-600 flex-shrink-0" />
                <span className="truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">{folder.name}</span>
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-warmgray-400 hover:text-red-600 transition-colors">
                    <MoreVertical className="w-6 h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="p-2 rounded-xl">
                  <DropdownMenuItem
                    onClick={() => handleDeleteFolder(folder)}
                    className="text-red-600 focus:bg-red-50 focus:text-red-700 py-3 rounded-lg flex gap-3 text-base"
                  >
                    <Trash2 className="w-5 h-5 mr-1" />
                    Ordner löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Button
            onClick={() => {
              setUploadCategory(folder.parent_category)
              setUploadSubcategory(folder.id)
              setIsUploadOpen(true)
            }}
            className="w-full sm:w-auto h-[56px] px-8 text-lg font-bold shadow-md rounded-xl active:scale-95 transition-transform"
          >
            <Upload className="mr-3 h-6 w-6" />
            In "{folder.name}" ablegen
          </Button>
        </div>

        {/* Documents in folder */}
        {folderDocs.length > 0 ? (
          <div className="space-y-4">
            {folderDocs.map(renderDocumentItem)}
          </div>
        ) : (
          <div className="text-center py-20 bg-cream-50/30 border-2 border-dashed border-warmgray-200 rounded-3xl">
            <div className="w-20 h-20 rounded-full bg-warmgray-50 flex items-center justify-center mx-auto mb-6 text-warmgray-300">
              <Folder className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-warmgray-900 mb-2">Dieser Ordner ist leer</h3>
            <p className="text-lg text-warmgray-500 mb-8 max-w-xs mx-auto">
              Legen Sie Ihr erstes Dokument in diesen Ordner ab.
            </p>
            <Button
              onClick={() => {
                setUploadCategory(folder.parent_category)
                setUploadSubcategory(folder.id)
                setIsUploadOpen(true)
              }}
              size="lg"
              className="h-[56px] px-10 text-lg font-bold"
            >
              <Upload className="mr-3 h-5 w-5" />
              Dokument hinzufügen
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 overflow-x-hidden px-4 sm:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="space-y-3 pb-2">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-warmgray-900 leading-tight">
          Dokumente
        </h1>
        <p className="text-xl text-warmgray-600 max-w-2xl leading-[1.6]">
          Ihre wichtige Unterlagen sicher organisiert. Einfach zu finden, immer griffbereit.
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

      {/* Upgrade Nudge - shows when approaching document limit */}
      {userTier.limits.maxDocuments !== -1 && (
        <UpgradeNudge
          type="document"
          currentCount={documents.length}
          maxCount={userTier.limits.maxDocuments}
        />
      )}

      {/* Search and View Toggle - Senior Friendly (56px) */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-warmgray-400" />
          <Input
            type="search"
            placeholder="Nach Dokumenten suchen..."
            className="pl-14 h-14 text-lg rounded-2xl border-warmgray-200 focus:ring-sage-500 shadow-sm transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          onClick={() => openUploadDialog(selectedCategory || 'identitaet')}
          className="w-full sm:w-auto h-14 px-8 text-lg font-bold shadow-md rounded-2xl active:scale-95 transition-transform"
        >
          <Upload className="mr-3 h-6 w-6" />
          Dokument hinzufügen
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val)
          if (val.startsWith('custom:')) {
            const customId = val.replace('custom:', '')
            setSelectedCustomCategory(customId)
            setSelectedCategory(null)
          } else if (val === 'overview' || val === 'all') {
            setSelectedCustomCategory(null)
            setSelectedCategory(null)
          } else {
            setSelectedCustomCategory(null)
            setSelectedCategory(val as DocumentCategory)
          }
          setCurrentFolder(null) // Reset folder when changing category
        }}
      >
        <TabsList className="w-full h-auto flex-wrap justify-start bg-transparent gap-3 p-0 mb-6">
          {/* Overview Tab - First */}
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-sage-600 data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-warmgray-200 border-2 h-12 px-6 rounded-xl font-bold text-lg transition-all"
          >
            Übersicht
          </TabsTrigger>
          {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => {
            const count = getDocumentCountForCategory(key as DocumentCategory)
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-sage-600 data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-warmgray-200 border-2 h-12 px-6 rounded-xl font-bold text-lg transition-all"
              >
                {category.name} <span className="ml-2 px-2 py-0.5 rounded-full bg-black/10 text-base font-medium">{count}</span>
              </TabsTrigger>
            )
          })}
          {/* Custom Categories */}
          {customCategories.map((cat) => {
            const count = getDocumentCountForCustomCategory(cat.id)
            return (
              <TabsTrigger
                key={cat.id}
                value={`custom:${cat.id}`}
                className="data-[state=active]:bg-sage-600 data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-warmgray-200 border-2 h-12 px-6 rounded-xl font-bold text-lg transition-all group relative"
              >
                <Tag className="w-4 h-4 mr-2" />
                {cat.name} <span className="ml-2 px-2 py-0.5 rounded-full bg-black/10 text-base font-medium">{count}</span>
              </TabsTrigger>
            )
          })}
          {/* All Tab */}
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-sage-600 data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-warmgray-200 border-2 h-12 px-6 rounded-xl font-bold text-lg transition-all"
          >
            Alle <span className="ml-2 px-2 py-0.5 rounded-full bg-black/10 text-base font-medium">{validatedDocuments.length}</span>
          </TabsTrigger>
          {/* Add Category Button - Last */}
          {userTier.limits.maxCustomCategories !== 0 && (userTier.limits.maxCustomCategories === -1 || customCategories.length < userTier.limits.maxCustomCategories) && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => openCategoryDialog()}
              className="h-12 border-2 border-dashed border-sage-300 text-sage-600 hover:bg-sage-50 font-bold rounded-xl"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Neue Kategorie
            </Button>
          )}
        </TabsList>

        {/* Overview - Shows 3 newest documents + category overview */}
        <TabsContent value="overview" className="mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-sage-600" />
            </div>
          ) : (
            <div className="space-y-12">
              {/* Recent Documents */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-2xl font-bold text-warmgray-900">Zuletzt hinzugefügt</h2>
                  <Button variant="ghost" className="text-sage-600 font-bold text-lg" onClick={() => setActiveTab('all')}>
                    Alle ansehen
                  </Button>
                </div>
                {validatedDocuments.length > 0 ? (
                  <div className="space-y-4">
                    {validatedDocuments.slice(0, 3).map(renderDocumentItem)}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-cream-50/50 rounded-3xl border-2 border-dashed border-warmgray-200">
                    <FileText className="w-16 h-16 text-warmgray-300 mx-auto mb-4" />
                    <p className="text-xl text-warmgray-600 mb-6">Noch keine Dokumente vorhanden</p>
                    <Button onClick={() => openUploadDialog('identitaet')} size="lg" className="h-[56px] px-8 text-lg font-bold">
                      <Upload className="mr-3 h-5 w-5" />
                      Erstes Dokument hinzufügen
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* All documents view */}
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
                  : 'Fügen Sie Ihr erstes Dokument hinzu, um zu beginnen'}
              </p>
              {!searchQuery && (
                <Button onClick={() => openUploadDialog('identitaet')}>
                  <Upload className="mr-2 h-5 w-5" />
                  Dokument hinzufügen
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

        {/* Custom Category Views */}
        {customCategories.map((cat) => (
          <TabsContent key={cat.id} value={`custom:${cat.id}`} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header with actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Tag className="w-5 h-5 text-sage-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-warmgray-900">{cat.name}</h2>
                      {cat.description && (
                        <p className="text-sm text-warmgray-500">{cat.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCategoryDialog(cat)}
                      title="Bearbeiten"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Löschen
                    </Button>
                    <Button onClick={() => openUploadDialog(null, cat.id)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Dokument hinzufügen
                    </Button>
                  </div>
                </div>

                {/* Documents */}
                {filteredDocuments.length > 0 ? (
                  <div className="space-y-2">
                    {filteredDocuments.map(renderDocumentItem)}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-warmgray-200 rounded-lg">
                    <Tag className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
                    <h3 className="text-warmgray-700 font-medium mb-2">Keine Dokumente in dieser Kategorie</h3>
                    <p className="text-warmgray-500 text-sm mb-4">
                      Legen Sie ein Dokument ab, um es hier zu speichern
                    </p>
                    <Button onClick={() => openUploadDialog(null, cat.id)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Dokument hinzufügen
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Category Cards (when no category is selected) */}
      {(activeTab === 'overview' || activeTab === 'all') && !searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
          {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => {
            const Icon = iconMap[category.icon] || FileText
            const count = getDocumentCountForCategory(key as DocumentCategory)
            const categorySubcats = getSubcategoriesForCategory(key as DocumentCategory)
            return (
              <Card
                key={key}
                className="group cursor-pointer hover:border-sage-400 hover:shadow-xl transition-all duration-300 rounded-3xl border-2 overflow-hidden bg-white shadow-sm flex flex-col h-full"
                onClick={() => {
                  setActiveTab(key)
                  setSelectedCategory(key as DocumentCategory)
                  setCurrentFolder(null)
                }}
              >
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-600 transition-transform group-hover:scale-110">
                      <Icon className="w-8 h-8" />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-12 w-12 rounded-xl text-warmgray-400 hover:text-sage-700 hover:bg-sage-50 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        openUploadDialog(key as DocumentCategory)
                      }}
                    >
                      <PlusCircle className="w-6 h-6" />
                    </Button>
                  </div>
                  <CardTitle className="text-2xl font-bold text-warmgray-900 group-hover:text-sage-700 transition-colors">
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-8 pb-8 pt-0 flex-1 flex flex-col">
                  <p className="text-lg text-warmgray-600 leading-[1.6] mb-6 line-clamp-2">
                    {category.description}
                  </p>
                  <div className="mt-auto space-y-4 pt-4 border-t border-warmgray-100">
                    <div className="flex items-center justify-between text-base font-bold">
                      <span className="text-warmgray-500 uppercase tracking-wider text-xs font-black">Inhalt</span>
                      <span className="text-sage-700 bg-sage-50 px-3 py-1 rounded-full">{count} Dokument{count !== 1 ? 'e' : ''}</span>
                    </div>
                    {categorySubcats.length > 0 && (
                      <div className="flex items-center gap-2 text-base text-warmgray-500">
                        <Folder className="w-4 h-4" />
                        <span>{categorySubcats.length} Unterordner</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="w-full h-[100dvh] sm:h-auto sm:max-w-2xl p-0 overflow-hidden flex flex-col rounded-none sm:rounded-3xl border-none sm:border shadow-2xl">
          <DialogHeader className="p-6 sm:p-8 bg-sage-600 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl sm:text-3xl font-bold">Dokument ablegen</DialogTitle>
                <DialogDescription className="text-sage-100 text-lg mt-1">
                  Wählen Sie eine Kategorie für Ihre Unterlagen
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-xl hover:bg-white/10 text-white"
                onClick={() => setIsUploadOpen(false)}
              >
                <X className="w-7 h-7" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-white">
            <div className="space-y-4">
              <Label className="text-xl font-bold text-warmgray-900 block px-1">Kategorie wählen</Label>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setUploadCategory(key as DocumentCategory)
                      setUploadCustomCategory(null)
                      setUploadSubcategory(null)
                      setIsCreatingSubcategory(false)
                    }}
                    className={`p-4 text-left rounded-2xl border-2 transition-all flex items-center gap-3 min-h-[64px] ${uploadCategory === key && !uploadCustomCategory
                      ? 'border-sage-500 bg-sage-50 text-sage-800 shadow-sm'
                      : 'border-warmgray-200 hover:border-sage-300 text-warmgray-700 bg-white'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${uploadCategory === key && !uploadCustomCategory ? 'bg-sage-500 text-white' : 'bg-warmgray-100 text-warmgray-500'}`}>
                      {(() => {
                        const Icon = iconMap[category.icon] || FileText
                        return <Icon className="w-5 h-5" />
                      })()}
                    </div>
                    <span className="text-lg font-bold truncate leading-tight">{category.name}</span>
                  </button>
                ))}
                {/* Custom Categories */}
                {customCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setUploadCategory('sonstige')
                      setUploadCustomCategory(cat.id)
                      setUploadSubcategory(null)
                      setIsCreatingSubcategory(false)
                    }}
                    className={`p-4 text-left rounded-2xl border-2 transition-all flex items-center gap-3 min-h-[64px] ${uploadCustomCategory === cat.id
                      ? 'border-sage-500 bg-sage-50 text-sage-800 shadow-sm'
                      : 'border-warmgray-200 hover:border-sage-300 text-warmgray-700 bg-white'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${uploadCustomCategory === cat.id ? 'bg-sage-500 text-white' : 'bg-warmgray-100 text-warmgray-500'}`}>
                      <Tag className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-bold truncate leading-tight">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subcategory Selection - Dropdown (only for standard categories) */}
            {uploadCategory && !uploadCustomCategory && (
              <div className="space-y-4">
                <Label className="text-xl font-bold text-warmgray-900 block px-1">Unterordner (optional)</Label>
                <div className="space-y-4">
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
                    className="w-full h-14 px-4 rounded-xl border-2 border-warmgray-200 bg-white text-lg font-medium text-warmgray-900 focus:ring-4 focus:ring-sage-500/10 focus:border-sage-500 transition-all outline-none"
                  >
                    <option value="_none">In Hauptkategorie ablegen</option>
                    {getCategorySubcategoriesForUpload().map(sub => (
                      <option key={sub.id} value={sub.id}>
                        📁 {sub.name}
                      </option>
                    ))}
                    <option value="_new">+ Neuen Unterordner erstellen...</option>
                  </select>

                  {/* Create new subcategory inline */}
                  {isCreatingSubcategory && (
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Input
                        placeholder="Name des neuen Ordners"
                        value={newSubcategoryName}
                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleCreateSubcategory()
                          }
                        }}
                        autoFocus
                        className="h-14 text-lg px-5 rounded-xl border-sage-200 focus:border-sage-500"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCreateSubcategory}
                          disabled={!newSubcategoryName.trim()}
                          className="h-14 px-6 text-lg font-bold rounded-xl flex-1 sm:flex-initial"
                        >
                          Erstellen
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsCreatingSubcategory(false)
                            setNewSubcategoryName('')
                          }}
                          className="h-14 px-4 text-warmgray-500 hover:text-warmgray-900 text-lg rounded-xl flex-1 sm:flex-initial"
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File Selection - Drag & Drop */}
            <div className="space-y-4">
              <Label className="text-xl font-bold text-warmgray-900 block px-1">Datei auswählen</Label>
              <FileUpload
                selectedFile={uploadFile}
                onFileSelect={validateAndSetFile}
                onClear={() => setUploadFile(null)}
                className="border-2 border-dashed border-warmgray-300 rounded-2xl p-8 hover:border-sage-500 hover:bg-sage-50/30 transition-all cursor-pointer"
              />
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="title" className="text-lg font-bold text-warmgray-700">Titel</Label>
                <Input
                  id="title"
                  placeholder="z.B. Personalausweis"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="h-14 text-lg rounded-xl border-warmgray-200"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="notes" className="text-lg font-bold text-warmgray-700">Notiz (optional)</Label>
                <Input
                  id="notes"
                  placeholder="z.B. Gültig bis 2028"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="h-14 text-lg rounded-xl border-warmgray-200"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-lg font-bold text-warmgray-700">Ablaufdatum (optional)</Label>
                <DatePicker
                  value={uploadExpiryDate}
                  onChange={setUploadExpiryDate}
                  minDate={new Date().toISOString().split('T')[0]}
                  placeholder="Datum wählen"
                  className="h-14 text-lg w-full rounded-xl"
                />
              </div>

              {uploadExpiryDate && (
                <div className="space-y-3">
                  <Label className="text-lg font-bold text-warmgray-700">Erinnerung</Label>
                  <select
                    value={uploadCustomReminderDays === null ? '_default' : uploadCustomReminderDays.toString()}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === '_default') {
                        setUploadCustomReminderDays(null)
                      } else {
                        setUploadCustomReminderDays(parseInt(value))
                      }
                    }}
                    className="w-full h-14 px-4 rounded-xl border-2 border-warmgray-200 bg-white text-lg font-medium text-warmgray-900 focus:ring-4 focus:ring-sage-500/10 focus:border-sage-500 transition-all outline-none"
                  >
                    <option value="_default">Standard-Einstellung</option>
                    <option value="1">1 Tag vorher</option>
                    <option value="3">3 Tage vorher</option>
                    <option value="7">7 Tage vorher</option>
                    <option value="14">14 Tage vorher</option>
                    <option value="30">1 Monat vorher</option>
                  </select>
                </div>
              )}
            </div>

            {/* Reminder Watcher - only show when family members exist */}
            {uploadExpiryDate && familyMembers.length > 0 && (
              <div className="space-y-3 bg-cream-50/50 p-6 rounded-2xl border border-warmgray-200 shadow-inner">
                <Label className="text-lg font-bold text-warmgray-900">Termin-Überwachung teilen</Label>
                <select
                  value={uploadReminderWatcher || '_none'}
                  onChange={(e) => {
                    const value = e.target.value
                    setUploadReminderWatcher(value === '_none' ? null : value)
                  }}
                  className="w-full h-14 px-4 rounded-xl border-2 border-warmgray-200 bg-white text-lg font-medium text-warmgray-900 focus:ring-4 focus:ring-sage-500/10 focus:border-sage-500 transition-all outline-none"
                >
                  <option value="_none">Nur für mich</option>
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
                <p className="text-base text-warmgray-500 leading-relaxed">
                  Die gewählte Person erhält eine Bestätigung und wird ebenfalls rechtzeitig erinnert.
                </p>
              </div>
            )}

            <p className="text-center text-warmgray-500 text-base py-4 leading-relaxed">
              Ihre Dateien werden sicher verschlüsselt gespeichert.
            </p>
          </div>

          <DialogFooter className="p-6 sm:p-8 bg-warmgray-50/50 border-t border-warmgray-100 flex-row gap-4">
            <Button
              variant="outline"
              onClick={() => setIsUploadOpen(false)}
              className="h-14 px-8 text-lg font-bold rounded-xl flex-1 sm:flex-none"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || !uploadCategory || !uploadTitle.trim() || isUploading}
              className="h-14 px-10 text-lg font-bold rounded-xl flex-1 sm:flex-none shadow-md"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Hinzufügen...
                </>
              ) : (
                'Dokument ablegen'
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
            <div className="space-y-4">
              <Label className="text-lg font-bold">Zielordner wählen</Label>
              <div className="space-y-3 flex flex-col">
                {/* Remove from folder option */}
                <button
                  onClick={() => {
                    setMoveTargetFolder(null)
                    setIsCreatingFolderInMove(false)
                  }}
                  className={`w-full p-4 text-left rounded-2xl border-2 transition-all flex items-center gap-4 min-h-[64px] ${moveTargetFolder === null && !isCreatingFolderInMove
                    ? 'border-sage-500 bg-sage-50'
                    : 'border-warmgray-200 hover:border-sage-300 bg-white shadow-sm'
                    }`}
                >
                  <div className="h-10 w-10 rounded-full bg-warmgray-100 flex items-center justify-center text-warmgray-500">
                    <X className="w-6 h-6" />
                  </div>
                  <span className="text-lg font-medium">Kein Ordner (Hauptkategorie)</span>
                </button>

                {/* Existing folders for this category */}
                <div className="space-y-3 overflow-y-visible">
                  {getAvailableFoldersForMove().map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setMoveTargetFolder(folder.id)
                        setIsCreatingFolderInMove(false)
                      }}
                      className={`w-full p-4 text-left rounded-2xl border-2 transition-all flex items-center gap-4 min-h-[64px] ${moveTargetFolder === folder.id
                        ? 'border-sage-500 bg-sage-50'
                        : 'border-warmgray-200 hover:border-sage-300 bg-white shadow-sm'
                        }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-sage-100 flex items-center justify-center text-sage-600">
                        <Folder className="w-6 h-6 fill-current" />
                      </div>
                      <span className="text-lg font-bold truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>

                {/* Create new folder option */}
                <button
                  onClick={() => {
                    setIsCreatingFolderInMove(true)
                    setMoveTargetFolder(null)
                  }}
                  className={`w-full p-4 text-left rounded-2xl border-2 transition-all flex items-center gap-4 min-h-[64px] ${isCreatingFolderInMove
                    ? 'border-sage-500 bg-sage-50'
                    : 'border-dashed border-warmgray-300 bg-white hover:border-sage-400'
                    }`}
                >
                  <div className="h-10 w-10 rounded-full bg-warmgray-50 flex items-center justify-center text-warmgray-400">
                    <FolderPlus className="w-6 h-6" />
                  </div>
                  <span className="text-lg font-medium">Neuen Ordner erstellen...</span>
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

      {/* Bulk Action Bar - Senior Friendly (Fixed at bottom) */}
      {selectedDocuments.size > 0 && (
        <div className="fixed bottom-6 inset-x-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:min-w-[400px] bg-warmgray-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-50 animate-in slide-in-from-bottom-10 h-auto">
          <div className="flex items-center gap-4 w-full sm:w-auto border-b sm:border-b-0 border-warmgray-800 pb-3 sm:pb-0">
            <div className="h-10 w-10 rounded-full bg-sage-600 flex items-center justify-center">
              <Check className="w-6 h-6 text-white stroke-[3]" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span className="font-bold text-xl">{selectedDocuments.size}</span>
              <span className="text-warmgray-400 font-medium">Dokumente ausgewählt</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              size="lg"
              variant="secondary"
              className="bg-warmgray-800 hover:bg-warmgray-700 text-white h-[56px] px-6 flex-1 sm:flex-none font-bold text-lg rounded-xl transition-all"
              onClick={() => openMoveDialog()}
            >
              <MoveRight className="mr-3 h-5 w-5" />
              Verschieben
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-warmgray-400 hover:text-white h-[56px] px-6 flex-1 sm:flex-none font-bold text-lg rounded-xl transition-all"
              onClick={clearSelection}
            >
              <X className="mr-3 h-5 w-5" />
              <span>Abbrechen</span>
            </Button>
          </div>
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie erstellen'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Ändern Sie den Namen oder die Beschreibung der Kategorie.'
                : 'Erstellen Sie eine eigene Kategorie für Ihre Dokumente.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {categoryError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {categoryError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category-name">Name *</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="z.B. Fahrzeuge, Haustiere, Hobbys"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Beschreibung (optional)</Label>
              <Input
                id="category-description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Kurze Beschreibung der Kategorie"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveCategory} disabled={isSavingCategory || !categoryForm.name.trim()}>
              {isSavingCategory ? (
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

      {/* Upgrade Modal - friendly limit notification */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature={upgradeModalFeature}
        currentLimit={
          upgradeModalFeature === 'folder' ? userTier.limits.maxSubcategories :
            upgradeModalFeature === 'document' ? userTier.limits.maxDocuments :
              upgradeModalFeature === 'custom_category' ? userTier.limits.maxCustomCategories :
                undefined
        }
        basicLimit={
          upgradeModalFeature === 'folder' ? SUBSCRIPTION_TIERS.basic.limits.maxSubcategories :
            upgradeModalFeature === 'document' ? SUBSCRIPTION_TIERS.basic.limits.maxDocuments :
              upgradeModalFeature === 'custom_category' ? SUBSCRIPTION_TIERS.basic.limits.maxCustomCategories :
                undefined
        }
        premiumLimit={
          upgradeModalFeature === 'folder' ? 'Unbegrenzt' :
            upgradeModalFeature === 'document' ? 'Unbegrenzt' :
              upgradeModalFeature === 'custom_category' ? 'Unbegrenzt' :
                undefined
        }
      />
    </div>
  )
} 
