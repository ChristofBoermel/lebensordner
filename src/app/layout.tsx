import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PostHogProvider } from '@/components/analytics/posthog-provider'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { CookieConsent } from '@/components/consent/cookie-consent'
import { ErrorBoundary } from '@/components/error/error-boundary'
import { UnhandledRejectionProvider } from '@/components/error/unhandled-rejection-provider'
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
  const runtimePublicConfig = {
    supabaseUrl: process.env['SUPABASE_URL'] ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  }
  const runtimePublicConfigScript = `window.__LEBENSORDNER_PUBLIC_CONFIG__=${JSON.stringify(runtimePublicConfig).replace(/</g, '\\u003c')};`

  return (
    <html lang="de" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: runtimePublicConfigScript }} />
        <ThemeProvider>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <PostHogProvider>
                {children}
              </PostHogProvider>
            </Suspense>
            <CookieConsent />
            <UnhandledRejectionProvider />
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
