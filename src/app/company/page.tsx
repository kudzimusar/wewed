import type { Metadata } from 'next'
import { PublicDocumentHub } from '@/components/public/public-document-pages'

export const metadata: Metadata = {
  title: 'Company | Wewed',
  description: 'About Wewed, how wewed.pro works, contact guidance and careers information.',
  alternates: { canonical: '/company' },
}

export default function CompanyPage() {
  return <PublicDocumentHub category="company" />
}
