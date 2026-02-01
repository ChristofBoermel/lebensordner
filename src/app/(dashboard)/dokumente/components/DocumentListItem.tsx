'use client'

import React from 'react'
import {
    FileText,
    Check,
    MoreVertical,
    Eye,
    Download,
    MoveRight,
    Trash2,
    ChevronRight,
    LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatFileSize, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Document, DocumentCategory } from '@/types/database'

interface DocumentListItemProps {
    doc: Document
    categoryInfo: {
        name: string
        icon: string
    }
    subcategoryName?: string
    isSelected: boolean
    isHighlighted: boolean
    iconMap: Record<string, LucideIcon>
    onToggleSelection: (id: string) => void
    onNavigate: (doc: Document) => void
    onPreview: (doc: Document) => void
    onDownload: (doc: Document) => void
    onMove: (docIds: string[]) => void
    onDelete: (doc: Document) => void
}

export function DocumentListItem({
    doc,
    categoryInfo,
    subcategoryName,
    isSelected,
    isHighlighted,
    iconMap,
    onToggleSelection,
    onNavigate,
    onPreview,
    onDownload,
    onMove,
    onDelete
}: DocumentListItemProps) {
    const Icon = iconMap[categoryInfo.icon] || FileText

    return (
        <div
            id={`doc-${doc.id}`}
            onClick={() => onNavigate(doc)}
            className={cn(
                "group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer min-h-[72px] relative overflow-hidden",
                isHighlighted
                    ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300 ring-offset-2"
                    : isSelected
                        ? "bg-sage-50 border-sage-400"
                        : "bg-white border-warmgray-200 hover:border-sage-300 hover:bg-sage-50/20 shadow-sm"
            )}
        >
            {/* Checkbox - Large touch target (44px+) */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelection(doc.id)
                }}
                className={cn(
                    "aspect-square h-11 w-11 flex-shrink-0 rounded-xl border-2 flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-sage-500",
                    isSelected
                        ? "bg-sage-600 border-sage-600 text-white"
                        : "border-warmgray-300 bg-white group-hover:border-sage-400"
                )}
                aria-label={isSelected ? 'Auswahl aufheben' : 'Dokument auswählen'}
            >
                {isSelected && <Check className="w-6 h-6 stroke-[3]" />}
            </button>

            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="hidden xs:flex h-12 w-12 rounded-xl bg-sage-100 flex-shrink-0 items-center justify-center">
                    <Icon className="w-6 h-6 text-sage-700" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-bold text-lg text-warmgray-900 truncate leading-tight">
                        {doc.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-warmgray-600 leading-[1.6]">
                        <span className="truncate">{categoryInfo.name}</span>
                        {subcategoryName && (
                            <>
                                <ChevronRight className="w-4 h-4 flex-shrink-0 text-warmgray-400" />
                                <span className="truncate">{subcategoryName}</span>
                            </>
                        )}
                        <span className="hidden leading-none text-warmgray-300 xs:inline">•</span>
                        <span className="whitespace-nowrap">{formatFileSize(doc.file_size)}</span>
                        <span className="hidden leading-none text-warmgray-300 sm:inline">•</span>
                        <span className="hidden whitespace-nowrap sm:inline">{formatDate(doc.created_at)}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl text-warmgray-400 hover:text-sage-700 hover:bg-sage-50 transition-colors"
                            aria-label="Dokumentoptionen"
                        >
                            <MoreVertical className="w-6 h-6" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl border-warmgray-200">
                        <DropdownMenuItem onClick={() => onPreview(doc)} className="py-3 rounded-lg flex gap-3 text-base">
                            <Eye className="w-5 h-5 text-warmgray-500" />
                            Ansehen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload(doc)} className="py-3 rounded-lg flex gap-3 text-base">
                            <Download className="w-5 h-5 text-warmgray-500" />
                            Herunterladen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMove([doc.id])} className="py-3 rounded-lg flex gap-3 text-base">
                            <MoveRight className="w-5 h-5 text-warmgray-500" />
                            Verschieben
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2 bg-warmgray-100" />
                        <DropdownMenuItem
                            onClick={() => onDelete(doc)}
                            className="py-3 rounded-lg flex gap-3 text-base text-red-600 focus:bg-red-50 focus:text-red-700"
                        >
                            <Trash2 className="w-5 h-5" />
                            Löschen
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
