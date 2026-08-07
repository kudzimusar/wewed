import type { Metadata } from 'next'
import { PublicDocumentHub } from '@/components/public/public-document-pages'

export const metadata: Metadata = {
  title: 'Legal Center | Wewed',
  description: 'Terms, privacy, marketplace, vendor, AI and data policies for Wewed at wewed.pro.',
}

export default function LegalCenterPage() {
  return <PublicDocumentHub category="legal" />
}
