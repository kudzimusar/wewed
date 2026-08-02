import type { Metadata } from 'next'
import { PlannerMarketplaceCentre } from '@/components/marketplace/planner-marketplace-centre'

export const metadata: Metadata = {
  title: 'Planner Marketplace Centre | Wewed',
  description: 'Manage your professional planner profile, enquiries, appointments, and delegated wedding access in Wewed.',
  robots: { index: false, follow: false },
}

export default function PlannerMarketplacePage() {
  return <PlannerMarketplaceCentre />
}
