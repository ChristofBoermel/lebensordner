'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  LayoutDashboard,
  FileText,
  Heart,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Leaf,
  Menu,
  X,
  Bell,
  FileDown,
  CreditCard,
  Shield,
  Search
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { GlobalSearch } from '@/components/search/global-search'

interface DashboardNavProps {
  user: {
    email: string
    full_name?: string | null
    role?: string | null
  }
}

const navigation = [
  { name: 'Übersicht', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Dokumente', href: '/dokumente', icon: FileText },
  { name: 'Notfall & Vorsorge', href: '/notfall', icon: Heart },
  { name: 'Zugriff & Familie', href: '/zugriff', icon: Users },
  { name: 'Erinnerungen', href: '/erinnerungen', icon: Bell },
  { name: 'Export', href: '/export', icon: FileDown },
  { name: 'Abonnement', href: '/abo', icon: CreditCard },
]

const adminNavigation = [
  { name: 'Admin', href: '/admin', icon: Shield },
]

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user.email[0].toUpperCase()

  return (
    <>
      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-1 flex-col border-r border-warmgray-200 bg-white">
          {/* Logo */}
          <div className="flex h-20 items-center px-6 border-b border-warmgray-200">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-warmgray-900">Lebensordner</span>
            </Link>
          </div>

          {/* Search Button */}
          <div className="px-4 pt-4">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-warmgray-200 bg-warmgray-50 text-warmgray-500 hover:bg-warmgray-100 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left text-sm">Suchen...</span>
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-xs rounded bg-warmgray-200 text-warmgray-600">⌘K</kbd>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                    isActive
                      ? 'bg-sage-50 text-sage-700'
                      : 'text-warmgray-600 hover:bg-warmgray-50 hover:text-warmgray-900'
                  )}
                >
                  <item.icon className={cn('w-5 h-5', isActive ? 'text-sage-600' : 'text-warmgray-400')} />
                  {item.name}
                </Link>
              )
            })}
            
            {/* Admin Navigation - only show for admins */}
            {user.role === 'admin' && (
              <>
                <div className="my-4 border-t border-warmgray-200" />
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                        isActive
                          ? 'bg-red-50 text-red-700'
                          : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                      )}
                    >
                      <item.icon className={cn('w-5 h-5', isActive ? 'text-red-600' : 'text-red-400')} />
                      {item.name}
                    </Link>
                  )
                })}
              </>
            )}
          </nav>

          {/* User Menu */}
          <div className="border-t border-warmgray-200 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 hover:bg-warmgray-50 transition-colors">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-warmgray-900 truncate">
                      {user.full_name || 'Benutzer'}
                    </p>
                    <p 
                      className="text-xs text-warmgray-500 truncate cursor-pointer hover:text-warmgray-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(user.email)
                      }}
                      title={`${user.email} - Klicken zum Kopieren`}
                    >
                      {user.email.length > 20 
                        ? user.email.slice(0, 17) + '...' 
                        : user.email}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-warmgray-400 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mein Konto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/einstellungen" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Einstellungen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex h-20 items-center gap-x-4 border-b border-warmgray-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-warmgray-700"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Menü öffnen</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="flex flex-1 justify-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sage-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-warmgray-900">Lebensordner</span>
          </Link>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-sm">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user.full_name || 'Benutzer'}</p>
              <p className="text-xs text-warmgray-500 truncate">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/einstellungen" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Einstellungen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-warmgray-900/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white">
            <div className="flex h-20 items-center justify-between px-6 border-b border-warmgray-200">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-semibold text-warmgray-900">Lebensordner</span>
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2">
                <X className="w-6 h-6 text-warmgray-500" />
              </button>
            </div>
            <nav className="px-4 py-6 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                      isActive
                        ? 'bg-sage-50 text-sage-700'
                        : 'text-warmgray-600 hover:bg-warmgray-50 hover:text-warmgray-900'
                    )}
                  >
                    <item.icon className={cn('w-5 h-5', isActive ? 'text-sage-600' : 'text-warmgray-400')} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
