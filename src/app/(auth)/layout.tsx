import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { Lora } from 'next/font/google'

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${lora.variable}`}>
      {/* Left panel — dark branded sidebar (desktop only) */}
      <div className="hidden md:flex md:w-[45%] bg-sage-950 flex-col justify-between p-10 relative overflow-hidden">
        {/* Subtle leaf watermark */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern id="leaf-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <path
                d="M60 10 C80 10, 110 40, 110 60 C110 80, 80 110, 60 110 C60 110, 60 80, 40 60 C20 40, 40 10, 60 10 Z"
                fill="none"
                stroke="white"
                strokeWidth="0.8"
                opacity="0.05"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#leaf-pattern)" />
        </svg>

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-white">Lebensordner</span>
          </Link>
        </div>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <p
            className="text-3xl text-white leading-snug"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            Ihr digitales Lebensarchiv — sicher, privat und immer verfügbar.
          </p>
          <p className="text-sage-300 text-sm leading-relaxed">
            Lebensordner hilft Ihnen, wichtige Dokumente und Vorsorgeinformationen
            sicher zu organisieren — für sich und Ihre Familie.
          </p>
        </div>

        {/* Trust badges */}
        <div className="relative z-10">
          <div className="flex flex-col gap-2 text-sm text-sage-300">
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span>AES-256-Verschlüsselung</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🇩🇪</span>
              <span>DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>Zwei-Faktor-Authentifizierung</span>
            </div>
          </div>
          <p className="mt-6 text-xs text-sage-500">
            © 2026 Lebensordner Digital
          </p>
        </div>
      </div>

      {/* Right panel — form area */}
      <div className="flex-1 bg-cream-50 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden py-5 px-4 border-b border-warmgray-100">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-9 h-9 rounded-lg bg-sage-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-warmgray-900">Lebensordner</span>
          </Link>
        </header>

        {/* Form */}
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          {children}
        </main>

        {/* Mobile footer */}
        <footer className="md:hidden py-4 text-center text-xs text-warmgray-400 border-t border-warmgray-100">
          <p>🔒 AES-256 · 🇩🇪 DSGVO · ✓ 2FA</p>
        </footer>
      </div>
    </div>
  )
}
