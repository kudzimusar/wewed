import type { Metadata } from 'next'
import { CoupleDashboard } from '@/components/couple/couple-dashboard'

const title = 'Couple Dashboard | Wewed'
const description = 'Manage the private wedding site, invitations, planner relationship and account controls.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'couple dashboard', 'wedding management'],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function CouplePage() {
  return <CoupleDashboard />
}
