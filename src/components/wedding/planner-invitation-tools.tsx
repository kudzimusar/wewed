'use client'

import Link from 'next/link'
import { useState } from 'react'
import { QrCode, Ticket, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvitationManager } from '@/components/wedding/invitation-manager'
import { PhysicalInvitationQr } from '@/components/wedding/physical-invitation-qr'
import { PlannerTeamInviteManager } from '@/components/wedding/planner/planner-team-invite-manager'
import { WeddingPassAdministration } from '@/components/wedding/wedding-pass-administration'

type InvitationMode = 'guest' | 'pass' | 'team'

/**
 * Small launcher used throughout the Planner workspace.
 *
 * Invitations used to live in a Dialog. That made the operational delivery screen
 * disappear whenever the modal was closed and meant there was no bookmark/history
 * entry to return to. The launcher now opens the persistent Invitation Desk route.
 */
export function PlannerInvitationTools() {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="gap-1.5 border-gold/30 bg-espresso/95 text-champagne shadow-lg hover:bg-gold/10 hover:text-gold"
    >
      <Link href="/planner/invitations">
        <QrCode className="size-3.5" />
        <span>Invitations & QR</span>
      </Link>
    </Button>
  )
}

/** Persistent Invitation Desk workspace used by /planner/invitations. */
export function PlannerInvitationWorkspace() {
  const [mode, setMode] = useState<InvitationMode>('guest')

  return (
    <section className="rounded-3xl border border-gold/25 bg-ivory p-4 text-espresso shadow-2xl sm:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">
          Invitation Desk
        </p>
        <h1 className="wewed-heading mt-2 text-3xl sm:text-4xl">
          Invitations & secure QR
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-espresso/60">
          Each credential has one job. Printed Invitation Access is shared and read-only;
          Open Invitation is personal to one guest and carries RSVP identity; Wedding Pass
          is venue admission; project-team access is separate again. One QR never
          impersonates another.
        </p>
      </header>

      <nav
        className="mt-5 grid gap-2 rounded-2xl border border-gold/20 bg-white p-2 sm:grid-cols-3"
        aria-label="Invitation desk sections"
      >
        <Button
          type="button"
          variant={mode === 'guest' ? 'default' : 'ghost'}
          onClick={() => setMode('guest')}
          className={mode === 'guest' ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light' : 'min-h-12 justify-start text-espresso/65 hover:bg-ivory'}
        >
          <Users className="size-4" />
          Open Invitation · Guest cards, RSVP & guest QR
        </Button>
        <Button
          type="button"
          variant={mode === 'pass' ? 'default' : 'ghost'}
          onClick={() => setMode('pass')}
          className={mode === 'pass' ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light' : 'min-h-12 justify-start text-espresso/65 hover:bg-ivory'}
        >
          <Ticket className="size-4" />
          Wedding Pass · venue admission
        </Button>
        <Button
          type="button"
          variant={mode === 'team' ? 'default' : 'ghost'}
          onClick={() => setMode('team')}
          className={mode === 'team' ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light' : 'min-h-12 justify-start text-espresso/65 hover:bg-ivory'}
        >
          <UserPlus className="size-4" />
          Invite project team member
        </Button>
      </nav>

      {mode === 'guest' ? (
        <div className="mt-5">
          <PhysicalInvitationQr />
          <div className="mb-4 rounded-xl border border-gold/15 bg-white px-4 py-3">
            <p className="font-medium text-espresso">
              Open Invitation · digital wedding cards, RSVP & delivery
            </p>
            <p className="mt-1 text-sm leading-6 text-espresso/60">
              Personal guest rows keep their own private RSVP credential, invitation,
              delivery history and QR. They remain separate from the shared Printed
              Invitation Access QR above and from Wedding Pass admission.
            </p>
          </div>
          <InvitationManager compact />
        </div>
      ) : mode === 'pass' ? (
        <div className="mt-5">
          <WeddingPassAdministration />
        </div>
      ) : (
        <div className="mt-5">
          <PlannerTeamInviteManager />
        </div>
      )}
    </section>
  )
}
