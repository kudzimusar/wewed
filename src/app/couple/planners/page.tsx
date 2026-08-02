import type { Metadata } from 'next'
import { CouplePlannerCentre } from '@/components/marketplace/couple-planner-centre'

const title = 'Your Planner Centre | Wewed'
const description = 'Search, shortlist, appoint, and control delegated planner access for your Wewed wedding.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'planner appointment', 'wedding planning'],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function CouplePlannerCentrePage() {
  return <CouplePlannerCentre />
}
