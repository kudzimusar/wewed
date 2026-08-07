import type { Metadata } from 'next'
import { PublicDocumentHub } from '@/components/public/public-document-pages'

export const metadata: Metadata = {
  title: 'Trust & Safety | Wewed',
  description: 'Privacy, marketplace safety, verification, review integrity, security and accessibility guidance for Wewed.',
  alternates: { canonical: '/trust' },
}

export default function TrustCenterPage() {
  return <PublicDocumentHub category="trust" />
}
