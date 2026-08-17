'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlannerAdaptiveNavigation } from '@/components/navigation/planner-adaptive-navigation'
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
      <main
        data-planner-portfolio-shell
        className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-espresso text-champagne"
      >
        <header
          data-planner-portfolio-header
          className="relative z-[130] flex h-16 shrink-0 items-center gap-3 border-b border-gold/15 bg-espresso px-3 shadow-lg sm:px-5"
        >
          <PlannerAdaptiveNavigation role="planner" showPortfolioLink={false} />
          <div className="min-w-0">
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.24em] text-gold/75">
              Wewed Planner
            </p>
            <h1 className="truncate font-serif text-base text-champagne sm:text-lg">
              All weddings
            </h1>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <PlannerPortfolioCommandCentre />
        </div>
      </main>
    </DashboardAuthGate>
  )
}
