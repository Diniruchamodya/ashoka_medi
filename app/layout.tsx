import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: {
    default: 'Ashoka Medi-Lab',
    template: '%s | Ashoka Medi-Lab',
  },
  description:
    'Ashoka Medi-Lab laboratory management: test orders, lab queue, reports, and multi-branch sales.',
  generator: 'v0.app',
  icons: {
    icon: '/images/ashoka-logo.jpg',
    apple: '/images/ashoka-logo.jpg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#03b5d9',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
