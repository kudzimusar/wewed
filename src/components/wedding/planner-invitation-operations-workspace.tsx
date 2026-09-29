'use client'

import Link from 'next/link'
import { ArrowLeft, MessageCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvitationManager } from '@/components/wedding/invitation-manager'
import { PhysicalInvitationQr } from '@/components/wedding/physical-invitation-qr'
import { PlannerTeamInviteManager } from '@/components/wedding/planner/planner-team-invite-manager'
import { WeddingPassAdministration } from '@/components/wedding/wedding-pass-administration'

export function PlannerInvitationOperationsWorkspace() {
  return (
    <div
      data-planner-module-scroll="true"
      className="h-full overflow-y-auto bg-espresso px-3 py-4 text-champagne sm:px-5 sm:py-5"
    >
      <div className="mx-auto w-full max-w-[1500px] space-y-5">
        <header className="rounded-2xl border border-gold/15 bg-champagne/[0.04] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/75">
                Guest invitation operations
              </p>
              <h2 className="mt-1 font-serif text-3xl text-champagne">Open Invitation</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/55">
                Search, prepare, track and administer each guest&apos;s private invitation from one durable workspace.
                This page has its own URL, so browser refresh, Back/Forward and bookmarks return to the same tool.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="border-gold/25 bg-transparent text-champagne hover:bg-gold/10 hover:text-gold">
                <Link href="/planner/guests#planner-workspace"><ArrowLeft className="size-4" />Guest list</Link>
              </Button>
              <Button asChild variant="outline" className="border-gold/25 bg-transparent text-champagne hover:bg-gold/10 hover:text-gold">
                <Link href="/messages"><MessageCircle className="size-4" />Messages</Link>
              </Button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="size-4 text-gold" />
            <div>
              <p className="text-sm font-semibold">Printed Invitation Access</p>
              <p className="text-xs text-champagne/45">
                Shared physical-card access remains separate from personal guest invitations and Wedding Passes.
              </p>
            </div>
          </div>
          <PhysicalInvitationQr />
        </section>

        <InvitationManager compact />

        <section className="grid gap-4 xl:grid-cols-2">
          <details className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4">
            <summary className="cursor-pointer font-serif text-xl text-champagne">Wedding Pass administration</summary>
            <p className="mt-1 text-xs leading-5 text-champagne/45">
              Venue admission remains separate from invitation delivery.
            </p>
            <div className="mt-4"><WeddingPassAdministration /></div>
          </details>
          <details className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4">
            <summary className="cursor-pointer font-serif text-xl text-champagne">Project team invitations</summary>
            <p className="mt-1 text-xs leading-5 text-champagne/45">
              Invite planners and wedding-team users without mixing them with guest RSVP credentials.
            </p>
            <div className="mt-4"><PlannerTeamInviteManager /></div>
          </details>
        </section>
      </div>
    </div>
  )
}
