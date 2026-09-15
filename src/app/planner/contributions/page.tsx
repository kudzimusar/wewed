'use client'

import { useRouter } from 'next/navigation'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { ContributionGovernancePanel } from '@/components/wedding/planner/contribution-governance-panel'
import { PlannerContributionsWorkspace } from '@/components/wedding/planner/planner-contributions-workspace'

export default function PlannerContributionsPage() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Contributions"
      description="Sign in as an assigned planner, coordinator, owner, or approved team member."
      onClose={() => router.push('/planner/overview')}
    >
      <div className="min-h-screen bg-espresso px-3 py-5 text-champagne sm:px-5 sm:py-7">
        <div className="mx-auto max-w-7xl space-y-5">
          <ContributionGovernancePanel />
          <PlannerContributionsWorkspace embedded />
        </div>
      </div>
    </DashboardAuthGate>
  )
}
