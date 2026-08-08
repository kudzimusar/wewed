import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicDocumentDetail } from '@/components/public/public-document-pages'
import { getPublicDocument, getPublicDocuments } from '@/lib/public-site-documents'

export function generateStaticParams() {
  return getPublicDocuments('legal').map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const document = getPublicDocument('legal', slug)
  if (!document) return {}
  return { title: `${document.title} | Wewed`, description: document.summary, alternates: { canonical: `/legal/${slug}` } }
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const document = getPublicDocument('legal', slug)
  if (!document) notFound()
  return <PublicDocumentDetail document={document} />
}
