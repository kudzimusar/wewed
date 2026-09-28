import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocalCiBrowserMode } from '@/lib/ci-browser-mode'
import { IvoryFloralGoldUatPreview } from './preview'

export const metadata: Metadata = {
  title: 'Ivory Floral Gold UAT | Wewed',
  description: 'Preview-only UAT surface for the Ivory Floral Gold guest invitation experience.',
  robots: { index: false, follow: false },
}

export default function IvoryFloralGoldUatPage() {
  if (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && !isLocalCiBrowserMode())
  ) {
    notFound()
  }
  return <IvoryFloralGoldUatPreview />
}

export const dynamic = 'force-dynamic'
