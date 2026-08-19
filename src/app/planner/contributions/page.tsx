'use client'

import { useRouter } from 'next/navigation'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { PlannerContributionsWorkspace } from '@/components/wedding/planner/planner-contributions-workspace'

export default function PlannerContributionsPage() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Planner Contributions"
      description="Sign in as an assigned planner, coordinator, owner, or approved team member."
      onClose={() => router.push('/')}
    >
      <PlannerContributionsWorkspace />
    </DashboardAuthGate>
  )
}
