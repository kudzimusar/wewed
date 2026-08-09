'use client'

import { useRouter } from 'next/navigation'
import { PlannerPortfolioCommandCentre } from '@/components/wedding/planner-portfolio-command-centre'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export default function PlannerPortfolioPage() {
  const router = useRouter()

  return (
    <DashboardAuthGate
      allowedRoles={['planner']}
      wrongRoleMessage="This portfolio is available to approved Wewed planner accounts."
      title="Wewed Planner Portfolio"
      description="Sign in as an approved planner to see your managed weddings and portfolio priorities."
      onClose={() => router.push('/')}
    >
      <main className="h-dvh min-h-dvh overflow-hidden bg-espresso">
        <PlannerPortfolioCommandCentre />
      </main>
    </DashboardAuthGate>
  )
}
