'use client'

import Link from 'next/link'

export default function LegacyAccessPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm space-y-3">
        <p className="font-semibold">Dieser alte Zugriffslink wird nicht mehr unterstuetzt.</p>
        <p className="text-sm">
          Bitte bitten Sie den Besitzer um einen neuen sicheren Zugriffslink.
        </p>
        <Link href="/zugriff" className="text-sm font-medium underline">
          Zurueck zu Zugriff &amp; Familie
        </Link>
      </div>
    </div>
  )
}
