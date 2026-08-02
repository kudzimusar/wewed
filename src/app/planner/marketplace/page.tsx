import type { Metadata } from 'next'
import { PlannerMarketplaceCentre } from '@/components/marketplace/planner-marketplace-centre'

const title = 'Planner Marketplace Centre | Wewed'
const description = 'Manage your professional planner profile, enquiries, appointments, and delegated wedding access in Wewed.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'planner marketplace', 'planner business'],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function PlannerMarketplacePage() {
  return <PlannerMarketplaceCentre />
}
