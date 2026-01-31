'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'
type FontSize = 'normal' | 'large' | 'xlarge'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  seniorMode: boolean
  setSeniorMode: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [seniorMode, setSeniorMode] = useState<boolean>(false)

  useEffect(() => {
    // Force light theme and remove saved theme
    setTheme('light')
    setResolvedTheme('light')
    localStorage.removeItem('theme')

    // Load saved font size
    const savedFontSize = localStorage.getItem('fontSize') as FontSize | null
    if (savedFontSize) {
      setFontSize(savedFontSize)
    }
    // Load saved senior mode
    const savedSeniorMode = localStorage.getItem('seniorMode')
    if (savedSeniorMode === 'true') {
      setSeniorMode(true)
    }
  }, [])

  useEffect(() => {
    const root = window.document.documentElement

    // Force light mode
    setResolvedTheme('light')

    // Apply theme class
    root.classList.remove('dark')
    root.classList.add('light')
  }, [theme])

  // Listen for system theme changes - Disabled for Version 1
  useEffect(() => {
    // Dark mode disabled
  }, [])

  // Apply font size
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('font-normal', 'font-large', 'font-xlarge')
    root.classList.add(`font-${fontSize}`)
    localStorage.setItem('fontSize', fontSize)
  }, [fontSize])

  // Apply senior mode
  useEffect(() => {
    const root = window.document.documentElement
    if (seniorMode) {
      root.classList.add('senior-mode')
    } else {
      root.classList.remove('senior-mode')
    }
    localStorage.setItem('seniorMode', String(seniorMode))
  }, [seniorMode])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, fontSize, setFontSize, seniorMode, setSeniorMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
