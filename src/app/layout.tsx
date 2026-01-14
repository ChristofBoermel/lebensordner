import type { Metadata } from 'next'
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
    <html lang="de">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
