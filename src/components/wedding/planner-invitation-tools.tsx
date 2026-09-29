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

export function PlannerInvitationTools({ embedded = false }: { embedded?: boolean }) {
  const [mode, setMode] = useState<InvitationMode>('guest')

  if (!embedded) {
    return (
      <Button asChild
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

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-5">
      <div className="rounded-3xl border border-gold/20 bg-ivory p-4 text-espresso shadow-2xl sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Planner invitation command center</p>
          <h1 className="mt-2 font-serif text-3xl">Invitations & secure QR</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-espresso/60">
            Printed Invitation Access, personal Open Invitations, Wedding Passes and project-team access are separate authorities. Use this page as the durable workspace for guest invitation preparation, delivery tracking and follow-up.
          </p>
        </div>

        <div className="mt-5 grid gap-2 rounded-2xl border border-gold/20 bg-white p-2 sm:grid-cols-3">
          <Button
            type="button"
            variant={mode === 'guest' ? 'default' : 'ghost'}
            onClick={() => setMode('guest')}
            className={mode === 'guest' ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light' : 'min-h-12 justify-start text-espresso/65 hover:bg-ivory'}
          >
            <Users className="size-4" />
            Open Invitation · Guest delivery
          </Button>
          <Button
            type="button"
            variant={mode === 'pass' ? 'default' : 'ghost'}
            onClick={() => setMode('pass')}
            className={mode === 'pass' ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light' : 'min-h-12 justify-start text-espresso/65 hover:bg-ivory'}
          >
            <Ticket className="size-4" />
            Wedding Pass · Venue admission
          </Button>
          <Button
            type="button"
            variant={mode === 'team' ? 'default' : 'ghost'}
            onClick={() => setMode('team')}
            className={mode === 'team' ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light' : 'min-h-12 justify-start text-espresso/65 hover:bg-ivory'}
          >
            <UserPlus className="size-4" />
            Project team access
          </Button>
        </div>

        {mode === 'guest' ? (
          <div className="mt-5">
            <PhysicalInvitationQr />
            <div className="mb-4 rounded-xl border border-gold/15 bg-white px-4 py-3">
              <p className="font-medium text-espresso">Open Invitation · Digital wedding cards, RSVP and delivery register</p>
              <p className="mt-1 text-sm leading-6 text-espresso/60">
                Personal guest rows keep their own RSVP credentials and digital cards. Sending and delivery tracking below never turns an invitation into a Wedding Pass.
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
      </div>
    </section>
  )
}
