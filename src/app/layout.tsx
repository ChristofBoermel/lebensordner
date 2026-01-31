import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PostHogProvider } from '@/components/analytics/posthog-provider'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { CookieConsent } from '@/components/consent/cookie-consent'
import { ErrorBoundary } from '@/components/error/error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lebensordner Digital - Ihre wichtigen Unterlagen an einem Ort',
  description: 'Der sichere digitale Lebensorganisator für Ihre persönlichen Unterlagen und Vorsorgeinformationen. Schaffen Sie Klarheit für sich und Ihre Familie.',
  keywords: ['Lebensordner', 'Vorsorge', 'Digitale Unterlagen', 'Notfall', 'Familie', 'Dokumente'],
  authors: [{ name: 'Lebensordner Digital' }],
  openGraph: {
    title: 'Lebensordner Digital',
    description: 'Der sichere digitale Lebensorganisator für Ihre persönlichen Unterlagen.',
    type: 'website',
    locale: 'de_DE',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="light" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <PostHogProvider>
                {children}
              </PostHogProvider>
            </Suspense>
            <CookieConsent />
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
