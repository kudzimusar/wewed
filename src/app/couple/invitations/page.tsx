import type { Metadata } from 'next'
import { CoupleInvitationsCentre } from '@/components/couple/couple-invitations-centre'

const title = 'Guests & Invitations | Wewed'
const description = 'Generate, export and rotate guest-specific invitation links and QR codes.'

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function CoupleInvitationsPage() {
  return <CoupleInvitationsCentre />
}
