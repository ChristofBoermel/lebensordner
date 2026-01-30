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
    if (!uploadFile || !uploadCategory || !uploadTitle) return

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
          title: uploadTitle,
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
      setUploadError(error.message || 'Fehler beim Hochladen. Bitte versuchen Sie es erneut.')
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

  // Delete folder handler
  const handleDeleteFolder = async (folder: Subcategory, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent folder click

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

  const filteredDocuments = documents.filter(doc => {
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
    return documents.filter(d => d.category === category && !d.custom_category_id).length
  }

  const getDocumentCountForCustomCategory = (categoryId: string) => {
    return documents.filter(d => d.custom_category_id === categoryId).length
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
    const isHighlighted = highlightedDoc === doc.id

    return (
      <div
        key={doc.id}
        id={`doc-${doc.id}`}
        className={`document-item group transition-all duration-300 ${isHighlighted
          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 ring-offset-2'
          : isSelected
            ? 'bg-sage-50 border-sage-300'
            : ''
          }`}
      >
        {/* Checkbox */}
        <button
          onClick={() => toggleDocumentSelection(doc.id)}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
            ? 'bg-sage-500 border-sage-500 text-white'
            : 'border-warmgray-300 hover:border-sage-400'
            }`}
        >
          {isSelected && <Check className="w-4 h-4" />}
        </button>

        <div className="flex items-start gap-4 flex-1 min-w-0 py-2">
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
        <div className="flex items-center gap-2">
          {/* Mobile/Compact Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-warmgray-400">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPreviewDocument(doc)} className="py-3">
                <Eye className="w-4 h-4 mr-2" />
                Ansehen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload(doc)} className="py-3">
                <Download className="w-4 h-4 mr-2" />
                Herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openMoveDialog([doc.id])} className="py-3">
                <MoveRight className="w-4 h-4 mr-2" />
                Verschieben
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(doc)} className="text-red-600 py-3">
                <Trash2 className="w-4 h-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            Dokument hinzufügen
          </Button>
        </div>

        {/* Folder Grid - Always show to allow creating folders */}
        <div>
          <h3 className="text-sm font-medium text-warmgray-600 mb-3">Unterordner</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categorySubcategories.map(subcategory => {
              const docCount = getDocumentsForSubcategory(subcategory.id).length
              return (
                <div
                  key={subcategory.id}
                  className="relative p-4 rounded-lg border-2 border-warmgray-200 hover:border-sage-400 hover:bg-sage-50 transition-all text-left group cursor-pointer"
                  onClick={() => setCurrentFolder(subcategory)}
                >
                  {/* Delete button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteFolder(subcategory, e)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-red-100 text-warmgray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    title="Ordner löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center justify-center mb-3">
                    <Folder className="w-12 h-12 text-sage-500 group-hover:text-sage-600 transition-colors" />
                  </div>
                  <p className="font-medium text-warmgray-800 text-center truncate">{subcategory.name}</p>
                  <p className="text-xs text-warmgray-500 text-center mt-1">
                    {docCount} Dokument{docCount !== 1 ? 'e' : ''}
                  </p>
                </div>
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
            In "{folder.name}" ablegen
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
              Legen Sie ein Dokument ab, um es hier zu speichern
            </p>
            <Button
              onClick={() => {
                setUploadCategory(folder.parent_category)
                setUploadSubcategory(folder.id)
                setIsUploadOpen(true)
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Dokument hinzufügen
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

      {/* Upgrade Nudge - shows when approaching document limit */}
      {userTier.limits.maxDocuments !== -1 && (
        <UpgradeNudge
          type="document"
          currentCount={documents.length}
          maxCount={userTier.limits.maxDocuments}
        />
      )}

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
        <TabsList className="w-full h-auto flex-wrap justify-start bg-transparent gap-2 p-0">
          {/* Overview Tab - First */}
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700"
          >
            Übersicht
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
          {/* Custom Categories */}
          {customCategories.map((cat) => {
            const count = getDocumentCountForCustomCategory(cat.id)
            return (
              <TabsTrigger
                key={cat.id}
                value={`custom:${cat.id}`}
                className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700 group relative"
              >
                <Tag className="w-3 h-3 mr-1" />
                {cat.name} ({count})
              </TabsTrigger>
            )
          })}
          {/* All Tab */}
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700"
          >
            Alle ({documents.length})
          </TabsTrigger>
          {/* Add Category Button - Last */}
          {userTier.limits.maxCustomCategories !== 0 && (userTier.limits.maxCustomCategories === -1 || customCategories.length < userTier.limits.maxCustomCategories) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openCategoryDialog()}
              className="h-8 text-sage-600 hover:text-sage-700 hover:bg-sage-50"
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Neue Kategorie
            </Button>
          )}
        </TabsList>

        {/* Overview - Shows 3 newest documents + category overview */}
        <TabsContent value="overview" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Recent Documents */}
              <div>
                <h2 className="text-lg font-semibold text-warmgray-900 mb-4">Zuletzt hinzugefügt</h2>
                {documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.slice(0, 3).map(renderDocumentItem)}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-warmgray-200 rounded-lg">
                    <FileText className="w-10 h-10 text-warmgray-300 mx-auto mb-3" />
                    <p className="text-warmgray-500">Noch keine Dokumente vorhanden</p>
                    <Button onClick={() => openUploadDialog('identitaet')} className="mt-3">
                      <Upload className="mr-2 h-4 w-4" />
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
            {/* Documents Grid */}
            {view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white dark:bg-warmgray-900 rounded-xl border border-warmgray-200 dark:border-warmgray-800 p-4 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-sage-50 dark:bg-sage-900/30 flex items-center justify-center text-sage-600 dark:text-sage-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 -mr-2"> {/* Improved touch target */}
                            <MoreVertical className="w-5 h-5 text-warmgray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPreviewDocument(doc)} className="py-2.5"> {/* Taller item */}
                            <Eye className="w-4 h-4 mr-2" />
                            Ansehen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(doc)} className="py-2.5">
                            <Download className="w-4 h-4 mr-2" />
                            Herunterladen
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(doc)}
                            className="text-red-600 py-2.5"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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
        </div>)}
      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="w-full h-[100dvh] sm:h-auto sm:max-w-lg p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Neues Dokument</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  className={`p-3 text-left rounded-lg border-2 transition-colors ${uploadCategory === key && !uploadCustomCategory
                    ? 'border-sage-500 bg-sage-50 text-sage-800'
                    : 'border-warmgray-200 hover:border-warmgray-400 text-warmgray-700'
                    }`}
                >
                  <span className="text-sm font-medium">{category.name}</span>
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
                  className={`p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-2 ${uploadCustomCategory === cat.id
                    ? 'border-sage-500 bg-sage-50 text-sage-800'
                    : 'border-warmgray-200 hover:border-warmgray-400 text-warmgray-700'
                    }`}
                >
                  <Tag className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Subcategory Selection - Dropdown (only for standard categories) */}
            {uploadCategory && !uploadCustomCategory && (
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
                onFileSelect={validateAndSetFile}
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

            {/* Custom Reminder - only show when expiry date is set */}
            {uploadExpiryDate && (
              <div className="space-y-2">
                <Label>Erinnerung (optional)</Label>
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
                  className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                >
                  <option value="_default">Standard (aus Einstellungen)</option>
                  <option value="1">1 Tag vorher</option>
                  <option value="3">3 Tage vorher</option>
                  <option value="7">7 Tage vorher</option>
                  <option value="14">14 Tage vorher</option>
                  <option value="30">1 Monat vorher</option>
                  <option value="60">2 Monate vorher</option>
                  <option value="90">3 Monate vorher</option>
                  <option value="180">6 Monate vorher</option>
                </select>
                <p className="text-xs text-warmgray-500">
                  Überschreibt die allgemeine Erinnerungseinstellung für dieses Dokument
                </p>
              </div>
            )}

            {/* Reminder Watcher - only show when expiry date is set and family members exist */}
            {uploadExpiryDate && familyMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Soll eine weitere Person den Termin im Blick haben?</Label>
                <select
                  value={uploadReminderWatcher || '_none'}
                  onChange={(e) => {
                    const value = e.target.value
                    setUploadReminderWatcher(value === '_none' ? null : value)
                  }}
                  className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                >
                  <option value="_none">Nein, nur ich</option>
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-warmgray-500">
                  Diese Person erhält eine Bestätigung und wird ebenfalls an den Termin erinnert
                </p>
              </div>
            )}
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
                  Hinzufügen...
                </>
              ) : (
                'Hinzufügen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

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
                  className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${moveTargetFolder === null && !isCreatingFolderInMove
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
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${moveTargetFolder === folder.id
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
                  className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${isCreatingFolderInMove
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
      {
        selectedDocuments.size > 0 && (
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
        )
      }

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
