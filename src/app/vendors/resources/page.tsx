import type { Metadata } from 'next'
import { PublicDocumentHub } from '@/components/public/public-document-pages'

export const metadata: Metadata = {
  title: 'Vendor Resources | Wewed',
  description: 'Vendor standards, marketplace ranking, verification, reviews and provider help for wewed.pro.',
}

export default function VendorResourcesPage() {
  return <PublicDocumentHub category="vendors" />
}
