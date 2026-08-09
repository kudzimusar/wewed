import type { Metadata } from 'next'
import { PlannerProfileQuickStart } from '@/components/marketplace/planner-profile-quick-start'

export const metadata: Metadata = {
  title: 'Get listed as a planner | Wewed',
  description: 'Create the essentials for your Wewed planner marketplace profile and submit them for review.',
  robots: { index: false, follow: false },
}

export default function PlannerGetListedPage() {
  return <PlannerProfileQuickStart />
}
