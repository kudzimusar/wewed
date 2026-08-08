import type { Metadata } from 'next'
import { PublicDocumentHub } from '@/components/public/public-document-pages'

export const metadata: Metadata = {
  title: 'Developer Center | Wewed',
  description: 'Wewed integration standards, API readiness guidance, security, versioning and developer terms.',
  alternates: { canonical: '/developers' },
}

export default function DeveloperCenterPage() {
  return <PublicDocumentHub category="developers" />
}
