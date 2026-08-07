import type { Metadata } from 'next'
import { PublicDocumentHub } from '@/components/public/public-document-pages'

export const metadata: Metadata = {
  title: 'Help Center | Wewed',
  description: 'Help for couples, planners, vendors and guests using Wewed at wewed.pro.',
  alternates: { canonical: '/help' },
}

export default function HelpCenterPage() {
  return <PublicDocumentHub category="help" />
}
