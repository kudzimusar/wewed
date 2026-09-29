'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { PlannerInvitationTools } from '@/components/wedding/planner-invitation-tools'

export default function PlannerInvitationsPage() {
  const router = useRouter()

  return (
    <DashboardAuthGate
      title="Wewed Invitation Command Center"
      description="Sign in with access to the selected wedding to prepare, track and manage guest invitations."
      onClose={() => router.push('/planner/overview#planner-workspace')}
    >
      <main className="min-h-dvh bg-espresso pb-10 text-champagne" data-planner-invitations-page>
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-3 pt-4 sm:px-5">
          <Button asChild type="button" variant="outline" className="border-gold/25 bg-transparent text-champagne hover:bg-gold/10 hover:text-gold">
            <Link href="/planner/guests#planner-workspace">
              <ArrowLeft className="size-4" />
              Back to Guests
            </Link>
          </Button>
          <p className="hidden text-xs text-champagne/45 sm:block">
            Bookmark this page: /planner/invitations
          </p>
        </div>
        <PlannerInvitationTools embedded />
      </main>
    </DashboardAuthGate>
  )
}
