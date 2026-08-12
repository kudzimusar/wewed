import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { MessageCircle } from 'lucide-react'
import { ProviderDirectory } from '@/components/providers/provider-directory'

export const metadata: Metadata = {
  title: 'Wedding Vendors & Venues | Wewed',
  description: 'Find approved wedding venues and service-provider company profiles on Wewed.',
  robots: { index: true, follow: true },
}

export default function VendorsPage() {
  return (
    <>
      <Link
        href="/vendor"
        className="fixed right-4 top-24 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/30 bg-espresso px-4 py-2.5 text-xs font-bold text-champagne shadow-xl transition hover:bg-espresso/90 sm:right-6"
        aria-label="Vendor sign in and inbox"
      >
        <MessageCircle className="size-4 text-gold" />
        Vendor sign in · Inbox
      </Link>
      <Suspense fallback={<main className="min-h-screen bg-ivory" />}>
        <ProviderDirectory />
      </Suspense>
    </>
  )
}
