import Link from 'next/link'
import { Leaf } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      {/* Header */}
      <header className="py-6">
        <div className="section-container">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-10 h-10 rounded-lg bg-sage-600 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-warmgray-900">Lebensordner</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-warmgray-500">
        <div className="section-container">
          <p>© 2026 Lebensordner Digital. Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  )
}
