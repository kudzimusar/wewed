import type { Metadata } from 'next'
import { AdminPlannerProfiles } from '@/components/marketplace/admin-planner-profiles'

export const metadata: Metadata = {
  title: 'Planner Profile Governance | Wewed',
  description: 'Review and govern public planner marketplace profiles in the Wewed administration console.',
  robots: { index: false, follow: false },
}

export default function AdminPlannerProfilesPage() {
  return <AdminPlannerProfiles />
}
