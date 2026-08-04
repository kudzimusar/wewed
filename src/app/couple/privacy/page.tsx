import type { Metadata } from 'next'
import { CouplePrivacyCentre } from '@/components/couple/couple-privacy-centre'

const title = 'Wedding Privacy & Access | Wewed'
const description = 'Choose public, invitation-only or private visibility for the active wedding.'

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function CouplePrivacyPage() {
  return <CouplePrivacyCentre />
}
