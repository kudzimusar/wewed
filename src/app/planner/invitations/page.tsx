'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { PlannerInvitationWorkspace } from '@/components/wedding/planner-invitation-tools'

const INVITATION_DESK_ROLES = ['admin', 'couple', 'planner'] as const
const INVITATION_DESK_WEDDING_ROLES = ['admin', 'owner', 'planner', 'coordinator'] as const

export default function PlannerInvitationsPage() {
  const router = useRouter()

  return (
    <DashboardAuthGate
      title="Invitation Desk"
      description="Sign in as the couple, an assigned planner, or an administrator to manage guest invitations."
      allowedRoles={INVITATION_DESK_ROLES}
      allowedWeddingRoles={INVITATION_DESK_WEDDING_ROLES}
      onClose={() => router.push('/planner/overview#planner-workspace')}
    >
      <main className="min-h-screen bg-espresso px-3 pb-24 pt-4 text-champagne sm:px-5 lg:px-7">
        <div className="mx-auto max-w-[1500px] space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-champagne/[0.035] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-gold text-espresso">
                <Send className="size-5" />
              </div>
              <div>
                <h1 className="wewed-heading text-xl text-champagne">Invitation Desk</h1>
                <p className="text-xs text-champagne/50">
                  Design, organise, send and track each guest&apos;s private invitation.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/planner/overview#planner-workspace')}
              className="border-gold/25 bg-transparent text-gold hover:bg-gold/10 hover:text-gold-light"
            >
              <ArrowLeft className="size-4" />
              Planner workspace
            </Button>
          </header>

          <PlannerInvitationWorkspace />
        </div>
      </main>
    </DashboardAuthGate>
  )
}
