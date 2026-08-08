import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicDocumentDetail } from '@/components/public/public-document-pages'
import { getPublicDocument, getPublicDocuments } from '@/lib/public-site-documents'

const RANKING_DESCRIPTION = 'How Wewed currently filters and orders planner marketplace results, including the signals that do not affect ranking today.'

export function generateStaticParams() {
  return getPublicDocuments('vendors').map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const document = getPublicDocument('vendors', slug)
  if (!document) return {}
  return {
    title: `${document.title} | Wewed`,
    description: slug === 'how-ranking-works' ? RANKING_DESCRIPTION : document.summary,
    alternates: { canonical: `/vendors/resources/${slug}` },
  }
}

export default async function VendorResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const document = getPublicDocument('vendors', slug)
  if (!document) notFound()
  return <PublicDocumentDetail document={document} />
}
