'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Leaf, Sun, Moon, Menu, X } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'
import { useState } from 'react'

export function LandingNav() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="border-b border-cream-200 dark:border-warmgray-800 bg-white/80 dark:bg-warmgray-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="section-container">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-warmgray-900 dark:text-warmgray-100">Lebensordner</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="#funktionen" className="text-warmgray-600 dark:text-warmgray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors">
              Funktionen
            </Link>
            <Link href="#sicherheit" className="text-warmgray-600 dark:text-warmgray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors">
              Sicherheit
            </Link>
            <Link href="#preise" className="text-warmgray-600 dark:text-warmgray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors">
              Preise
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-4">
              <Link href="/anmelden">
                <Button variant="ghost">Anmelden</Button>
              </Link>
              <Link href="/registrieren">
                <Button>Kostenlos testen</Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-warmgray-100 dark:hover:bg-warmgray-800 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-warmgray-600 dark:text-warmgray-400" />
              ) : (
                <Menu className="w-6 h-6 text-warmgray-600 dark:text-warmgray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-cream-200 dark:border-warmgray-800">
            <nav className="flex flex-col gap-4">
              <Link
                href="#funktionen"
                className="text-warmgray-600 dark:text-warmgray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Funktionen
              </Link>
              <Link
                href="#sicherheit"
                className="text-warmgray-600 dark:text-warmgray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sicherheit
              </Link>
              <Link
                href="#preise"
                className="text-warmgray-600 dark:text-warmgray-400 hover:text-sage-600 dark:hover:text-sage-400 transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Preise
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-cream-200 dark:border-warmgray-800">
                <Link href="/anmelden" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">Anmelden</Button>
                </Link>
                <Link href="/registrieren" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Kostenlos testen</Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
