'use client'

import { useRouter } from 'next/navigation'
import { PlannerPortfolioCommandCentre } from '@/components/wedding/planner-portfolio-command-centre'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export default function PlannerPortfolioPage() {
  const router = useRouter()

  return (
    <DashboardAuthGate
      title="Wewed Planner Portfolio"
      description="Sign in as an assigned planner or coordinator to see your managed weddings."
      onClose={() => router.push('/')}
    >
      <main className="h-dvh min-h-dvh overflow-hidden bg-espresso">
        <PlannerPortfolioCommandCentre />
      </main>
    </DashboardAuthGate>
  )
}
