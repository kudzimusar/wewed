import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ProviderDirectory } from '@/components/providers/provider-directory'

export const metadata: Metadata = {
  title: 'Wedding Vendors & Venues | Wewed',
  description: 'Find approved wedding venues and service-provider company profiles on Wewed.',
  robots: { index: true, follow: true },
}

export default function VendorsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ivory" />}>
      <ProviderDirectory />
    </Suspense>
  )
}
