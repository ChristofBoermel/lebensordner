'use client'

import React from 'react'
import {
    Folder,
    MoreVertical,
    Trash2,
    LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Subcategory } from '@/types/database'

interface FolderCardProps {
    subcategory: Subcategory
    docCount: number
    onOpen: (subcategory: Subcategory) => void
    onDelete: (subcategory: Subcategory, e: React.MouseEvent) => void
}

export function FolderCard({
    subcategory,
    docCount,
    onOpen,
    onDelete
}: FolderCardProps) {
    return (
        <div
            onClick={() => onOpen(subcategory)}
            className="group relative flex flex-col p-5 rounded-2xl border-2 border-warmgray-200 bg-white hover:border-sage-400 hover:bg-sage-50/30 transition-all duration-300 text-left cursor-pointer shadow-sm min-h-[140px]"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-sage-100 flex items-center justify-center text-sage-600 transition-transform group-hover:scale-110">
                    <Folder className="w-7 h-7 fill-current" />
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 min-h-[44px] min-w-[44px] -mt-2 -mr-2 rounded-full text-warmgray-400 hover:text-red-600 hover:bg-red-50"
                                aria-label="Ordneroptionen"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="p-2 rounded-xl">
                            <DropdownMenuItem
                                onClick={(e) => onDelete(subcategory, e as any)}
                                className="text-red-600 focus:bg-red-50 focus:text-red-700 py-3 rounded-lg flex gap-3 text-base"
                            >
                                <Trash2 className="w-5 h-5" />
                                Ordner löschen
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
                <h4 className="font-bold text-lg text-warmgray-900 truncate leading-tight group-hover:text-sage-800">
                    {subcategory.name}
                </h4>
                <p className="text-base text-warmgray-500 font-medium">
                    {docCount} Dokument{docCount !== 1 ? 'e' : ''}
                </p>
            </div>
        </div>
    )
}
