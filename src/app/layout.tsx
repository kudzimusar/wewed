import type { Metadata, Viewport } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import './product-remediation.css'
import './planner-ux.css'
import { Toaster } from '@/components/ui/toaster'
import { SkipToContent } from '@/components/wedding/skip-to-content'
import { StoreRehydrator } from '@/components/wedding/store-rehydrator'
import { PWARegister } from '@/components/wedding/pwa-register'
import { ThemeProvider } from '@/components/theme-provider'
import { WorkspaceQuickNavigation } from '@/components/navigation/workspace-quick-navigation'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const title = 'Wewed — Private Wedding Sites and Planner Marketplace'
const description =
  'Create an invitation-controlled wedding site, manage the planning process, and discover verified wedding planners through Wewed.'

export const metadata: Metadata = {
  metadataBase: new URL('https://wewed.pro'),
  title,
  description,
  keywords: [
    'Wewed',
    'private wedding website',
    'wedding planner marketplace',
    'wedding invitations',
    'wedding planning',
  ],
  authors: [{ name: 'Wewed' }],
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png',
  },
  openGraph: { title, description, type: 'website', url: 'https://wewed.pro' },
  twitter: { card: 'summary', title, description },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#BF9B5F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${inter.variable} ${cormorant.variable} antialiased bg-background text-foreground font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <StoreRehydrator />
          <PWARegister />
          <SkipToContent />
          {children}
          <WorkspaceQuickNavigation />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
