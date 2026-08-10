'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlannerPortfolioCommandCentre } from '@/components/wedding/planner-portfolio-command-centre'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export default function PlannerPortfolioPage() {
  const router = useRouter()

  useEffect(() => {
    if (window.location.hash === '#planner-workspace') {
      router.replace('/planner/overview#planner-workspace')
    }
  }, [router])

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
