import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IvoryFloralGoldUatPreview } from './preview'

export const metadata: Metadata = {
  title: 'Ivory Floral Gold UAT | Wewed',
  description: 'Preview-only UAT surface for the Ivory Floral Gold guest invitation experience.',
  robots: { index: false, follow: false },
}

export default function IvoryFloralGoldUatPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  return <IvoryFloralGoldUatPreview />
}

export const dynamic = 'force-dynamic'
