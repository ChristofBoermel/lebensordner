'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Search,
  FileText,
  Users,
  Clock,
  AlertCircle,
  Loader2,
  Command,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database'

interface SearchResult {
  id: string
  type: 'document' | 'trusted_person' | 'reminder'
  title: string
  subtitle?: string
  category?: DocumentCategory
  url: string
}

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    const searchResults: SearchResult[] = []

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Search documents (title, notes, and metadata)
      const { data: documents } = await supabase
        .from('documents')
        .select('id, title, category, notes, metadata')
        .eq('user_id', user.id)
        .or(`title.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`)
        .limit(5)

      if (documents) {
        documents.forEach((doc: Record<string, unknown>) => {
          searchResults.push({
            id: doc.id as string,
            type: 'document',
            title: doc.title as string,
            subtitle: DOCUMENT_CATEGORIES[(doc.category as DocumentCategory)]?.name,
            category: doc.category as DocumentCategory,
            url: `/dokumente?kategorie=${doc.category}&highlight=${doc.id}`,
          })
        })
      }

      // Secondary search: check metadata values for matches
      // This catches documents where the search term matches metadata but not title/notes
      const { data: allUserDocs } = await supabase
        .from('documents')
        .select('id, title, category, metadata')
        .eq('user_id', user.id)
        .not('metadata', 'is', null)
        .limit(50)

      if (allUserDocs) {
        allUserDocs.forEach((doc: Record<string, unknown>) => {
          // Skip if already in results
          if (searchResults.find(r => r.id === doc.id)) return
          const metadata = doc.metadata as Record<string, string> | null
          if (metadata) {
            const matchesMetadata = Object.values(metadata).some(
              (val) => typeof val === 'string' && val.toLowerCase().includes(searchQuery.toLowerCase())
            )
            if (matchesMetadata) {
              searchResults.push({
                id: doc.id as string,
                type: 'document',
                title: doc.title as string,
                subtitle: DOCUMENT_CATEGORIES[(doc.category as DocumentCategory)]?.name,
                category: doc.category as DocumentCategory,
                url: `/dokumente?kategorie=${doc.category}&highlight=${doc.id}`,
              })
            }
          }
        })
      }

      // Search trusted persons
      const { data: trustedPersons } = await supabase
        .from('trusted_persons')
        .select('id, name, relationship')
        .eq('user_id', user.id)
        .or(`name.ilike.%${searchQuery}%,relationship.ilike.%${searchQuery}%`)
        .limit(3)

      if (trustedPersons) {
        trustedPersons.forEach(person => {
          searchResults.push({
            id: person.id,
            type: 'trusted_person',
            title: person.name,
            subtitle: person.relationship || 'Vertrauensperson',
            url: '/zugriff',
          })
        })
      }

      // Search reminders
      const { data: reminders } = await supabase
        .from('reminders')
        .select('id, title, description')
        .eq('user_id', user.id)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(3)

      if (reminders) {
        reminders.forEach(reminder => {
          searchResults.push({
            id: reminder.id,
            type: 'reminder',
            title: reminder.title,
            subtitle: reminder.description || 'Erinnerung',
            url: '/erinnerungen',
          })
        })
      }

      setResults(searchResults)
      setSelectedIndex(0)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [supabase])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      navigateToResult(results[selectedIndex])
    }
  }

  const navigateToResult = (result: SearchResult) => {
    router.push(result.url)
    onClose()
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'document':
        return <FileText className="w-5 h-5 text-sage-600" />
      case 'trusted_person':
        return <Users className="w-5 h-5 text-blue-600" />
      case 'reminder':
        return <Clock className="w-5 h-5 text-amber-600" />
      default:
        return <FileText className="w-5 h-5 text-warmgray-400" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Suche</DialogTitle>
        <DialogDescription className="sr-only">
          Durchsuchen Sie Ihre Dokumente, Vertrauenspersonen und Erinnerungen
        </DialogDescription>
        {/* Search Input */}
        <div className="flex items-center border-b border-warmgray-200 px-4">
          <Search className="w-5 h-5 text-warmgray-400 mr-3" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Dokumente, Personen, Erinnerungen suchen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-14 text-base placeholder:text-warmgray-500"
          />
          {isSearching && <Loader2 className="w-5 h-5 text-warmgray-400 animate-spin" />}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-warmgray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-warmgray-300" />
              <p className="font-medium">Suche starten</p>
              <p className="text-sm mt-1">Geben Sie mindestens 2 Zeichen ein</p>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="p-8 text-center text-warmgray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-warmgray-300" />
              <p className="font-medium">Keine Ergebnisse</p>
              <p className="text-sm mt-1">Versuchen Sie einen anderen Suchbegriff</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => navigateToResult(result)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    selectedIndex === index ? 'bg-sage-50' : 'hover:bg-warmgray-50'
                  )}
                >
                  <span className="w-10 h-10 rounded-lg bg-warmgray-100 flex items-center justify-center flex-shrink-0">
                    {getIcon(result.type)}
                  </span>
                  <span className="flex-1 min-w-0 block">
                    <span className="font-medium text-warmgray-900 truncate block">
                      {result.title}
                    </span>
                    {result.subtitle && (
                      <span className="text-sm text-warmgray-500 truncate block">
                        {result.subtitle}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="w-4 h-4 text-warmgray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-warmgray-200 bg-warmgray-50 text-xs text-warmgray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-warmgray-200 font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-warmgray-200 font-mono">↓</kbd>
              <span>Navigieren</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-warmgray-200 font-mono">↵</kbd>
              <span>Öffnen</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-warmgray-200 font-mono">ESC</kbd>
            <span>Schließen</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
