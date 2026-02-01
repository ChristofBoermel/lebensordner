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
  Search,
  MessageSquare,
  Sun,
  Moon,
  Type,
  Eye
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { GlobalSearch } from '@/components/search/global-search'
import { useTheme } from '@/components/theme/theme-provider'

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
  { name: 'Familien-Übersicht', href: '/vp-dashboard', icon: Users },
  { name: 'Erinnerungen', href: '/erinnerungen', icon: Bell },
  { name: 'Export', href: '/export', icon: FileDown },
  { name: 'Abonnement', href: '/abo', icon: CreditCard },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  { name: 'Einstellungen', href: '/einstellungen', icon: Settings },
]

const adminNavigation = [
  { name: 'Admin', href: '/admin', icon: Shield },
]

const fontSizeLabels = {
  normal: 'Normal',
  large: 'Groß',
  xlarge: 'Sehr Groß'
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, setTheme, resolvedTheme, fontSize, setFontSize, seniorMode, setSeniorMode } = useTheme()

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
        <div className="flex flex-1 flex-col border-r border-warmgray-200 dark:border-warmgray-800 bg-white dark:bg-warmgray-900">
          {/* Logo */}
          <div className="flex h-20 items-center px-6 border-b border-warmgray-200 dark:border-warmgray-800">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-warmgray-900 dark:text-warmgray-100">Lebensordner</span>
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

          {/* Navigation - scrollable to handle Senior Mode larger text */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
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

            {/* Logout Button - visible for elderly users */}
            <div className="mt-4 pt-4 border-t border-warmgray-200">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="w-5 h-5 text-red-500" />
                Abmelden
              </button>
            </div>
          </nav>

          {/* Accessibility Controls */}
          <div className="border-t border-warmgray-200 px-4 py-4">
            {/* Einfache Ansicht Toggle - prominent placement */}
            <button
              onClick={() => setSeniorMode(!seniorMode)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors mb-3",
                seniorMode
                  ? "bg-sage-100 text-sage-700 dark:bg-sage-900/30 dark:text-sage-400"
                  : "bg-warmgray-50 text-warmgray-600 hover:bg-warmgray-100 dark:bg-warmgray-800 dark:text-warmgray-400 dark:hover:bg-warmgray-700"
              )}
              title="Größere Schrift und Bedienelemente"
            >
              <Eye className={cn("w-5 h-5", seniorMode ? "text-sage-600 dark:text-sage-400" : "text-warmgray-400")} />
              <span className="flex-1 text-left">Einfache Ansicht</span>
              <div className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                seniorMode ? "bg-sage-600" : "bg-warmgray-300 dark:bg-warmgray-600"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  seniorMode ? "translate-x-5" : "translate-x-1"
                )} />
              </div>
            </button>

            <div className="flex items-center justify-between gap-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-warmgray-100 dark:hover:bg-warmgray-800 transition-colors"
                title={resolvedTheme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-5 h-5 text-warmgray-600 dark:text-warmgray-400" />
                ) : (
                  <Moon className="w-5 h-5 text-warmgray-600" />
                )}
              </button>

              {/* Font Size Control */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 px-3 h-11 rounded-lg hover:bg-warmgray-100 dark:hover:bg-warmgray-800 transition-colors text-sm text-warmgray-600 dark:text-warmgray-400"
                    title="Schriftgröße ändern"
                  >
                    <Type className="w-5 h-5" />
                    <span className="hidden sm:inline">{fontSizeLabels[fontSize]}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuLabel>Schriftgröße</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setFontSize('normal')}
                    className={cn("cursor-pointer", fontSize === 'normal' && "bg-sage-50 text-sage-700")}
                  >
                    Normal
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFontSize('large')}
                    className={cn("cursor-pointer", fontSize === 'large' && "bg-sage-50 text-sage-700")}
                  >
                    Groß
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setFontSize('xlarge')}
                    className={cn("cursor-pointer", fontSize === 'xlarge' && "bg-sage-50 text-sage-700")}
                  >
                    Sehr Groß
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* User Menu */}
          <div className="border-t border-warmgray-200 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 hover:bg-warmgray-50 dark:hover:bg-warmgray-800 transition-colors">
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
                <DropdownMenuLabel>Mein Profil</DropdownMenuLabel>
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
      <div className="sticky top-0 z-40 flex h-16 sm:h-20 items-center gap-x-1 sm:gap-x-2 border-b border-warmgray-200 bg-white dark:bg-warmgray-900 dark:border-warmgray-800 px-2 sm:px-4 lg:hidden">
        <button
          type="button"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-warmgray-700 dark:text-warmgray-300 hover:bg-warmgray-100 dark:hover:bg-warmgray-800 transition-colors"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Menü öffnen</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="flex flex-1 justify-center min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sage-600 flex items-center justify-center flex-shrink-0">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-base sm:text-lg font-semibold text-warmgray-900 dark:text-warmgray-100 truncate">Lebensordner</span>
          </Link>
        </div>

        {/* Mobile Accessibility Controls - collapsed on very small screens */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={() => setSeniorMode(!seniorMode)}
            className={cn(
              "min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors",
              seniorMode
                ? "bg-sage-100 text-sage-600 dark:bg-sage-900/30 dark:text-sage-400"
                : "hover:bg-warmgray-100 dark:hover:bg-warmgray-800"
            )}
            title={seniorMode ? 'Einfache Ansicht aus' : 'Einfache Ansicht an'}
          >
            <Eye className={cn("w-5 h-5", seniorMode ? "text-sage-600 dark:text-sage-400" : "text-warmgray-600 dark:text-warmgray-400")} />
          </button>

          {/* Hide dark mode toggle on very small screens */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="hidden xs:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg hover:bg-warmgray-100 dark:hover:bg-warmgray-800 transition-colors"
            title={resolvedTheme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-5 h-5 text-warmgray-600 dark:text-warmgray-400" />
            ) : (
              <Moon className="w-5 h-5 text-warmgray-600" />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
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
              {/* Dark mode toggle in dropdown for small screens */}
              <DropdownMenuItem
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="cursor-pointer xs:hidden"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {resolvedTheme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/abo" className="cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Abonnement
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-warmgray-900/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white dark:bg-warmgray-900 flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex h-16 sm:h-20 items-center justify-between px-4 sm:px-6 border-b border-warmgray-200 dark:border-warmgray-800 flex-shrink-0">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-semibold text-warmgray-900 dark:text-warmgray-100">Lebensordner</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-warmgray-100 dark:hover:bg-warmgray-800 transition-colors"
              >
                <X className="w-6 h-6 text-warmgray-500 dark:text-warmgray-400" />
              </button>
            </div>

            {/* Search Button */}
            <div className="px-4 pt-4 flex-shrink-0">
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  setIsSearchOpen(true)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-warmgray-200 dark:border-warmgray-700 bg-warmgray-50 dark:bg-warmgray-800 text-warmgray-500 dark:text-warmgray-400 hover:bg-warmgray-100 dark:hover:bg-warmgray-700 transition-colors min-h-[48px]"
              >
                <Search className="w-5 h-5" />
                <span className="flex-1 text-left">Suchen...</span>
              </button>
            </div>

            {/* Scrollable Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[48px]',
                      isActive
                        ? 'bg-sage-50 text-sage-700 dark:bg-sage-900/30 dark:text-sage-400'
                        : 'text-warmgray-600 dark:text-warmgray-400 hover:bg-warmgray-50 dark:hover:bg-warmgray-800 hover:text-warmgray-900 dark:hover:text-warmgray-200'
                    )}
                  >
                    <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-sage-600 dark:text-sage-400' : 'text-warmgray-400')} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}

              {/* Admin Navigation - only show for admins */}
              {user.role === 'admin' && (
                <>
                  <div className="my-4 border-t border-warmgray-200 dark:border-warmgray-700" />
                  {adminNavigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[48px]',
                          isActive
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700'
                        )}
                      >
                        <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-red-600' : 'text-red-400')} />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    )
                  })}
                </>
              )}
            </nav>

            {/* Footer with Logout */}
            <div className="flex-shrink-0 border-t border-warmgray-200 dark:border-warmgray-800 p-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 min-h-[48px]"
              >
                <LogOut className="w-5 h-5 text-red-500 flex-shrink-0" />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
