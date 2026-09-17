import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IvoryFloralGoldOfficialPreview } from './preview'

export const metadata: Metadata = {
  title: 'Charity & Kudzie | Ivory Floral Gold | Wewed',
  description: 'Official guest-style preview of the Ivory Floral Gold digital wedding invitation.',
  robots: { index: false, follow: false },
}

export default function IvoryFloralGoldOfficialPreviewPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  return <IvoryFloralGoldOfficialPreview />
}

export const dynamic = 'force-dynamic'
