import type { Metadata } from 'next'
import { CouplePlannerCentre } from '@/components/marketplace/couple-planner-centre'

export const metadata: Metadata = {
  title: 'Your Planner Centre | Wewed',
  description: 'Search, shortlist, appoint, and control delegated planner access for your Wewed wedding.',
  robots: { index: false, follow: false },
}

export default function CouplePlannerCentrePage() {
  return <CouplePlannerCentre />
}
