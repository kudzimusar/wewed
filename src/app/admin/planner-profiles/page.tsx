import type { Metadata } from 'next'
import { AdminPlannerProfiles } from '@/components/marketplace/admin-planner-profiles'

const title = 'Planner Profile Governance | Wewed'
const description = 'Review and govern public planner marketplace profiles in the Wewed administration console.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'planner governance', 'marketplace administration'],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function AdminPlannerProfilesPage() {
  return <AdminPlannerProfiles />
}
