'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { ContributionGovernancePanel } from '@/components/wedding/planner/contribution-governance-panel'

export default function PlannerContributionSettingsPage() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Contribution Settings"
      description="Sign in as an assigned planner, coordinator, owner, or approved team member."
      onClose={() => router.push('/planner/contributions')}
    >
      <main className="min-h-screen bg-espresso px-3 py-5 text-champagne sm:px-5 sm:py-7">
        <div className="mx-auto max-w-7xl space-y-4">
          <Button type="button" variant="ghost" onClick={() => router.push('/planner/contributions')} className="text-champagne/70"><ArrowLeft className="size-4" />Back to Contributions</Button>
          <ContributionGovernancePanel />
        </div>
      </main>
    </DashboardAuthGate>
  )
}
