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
 * The invitation centre is a first-class Planner destination. Keeping it on a real route means
 * closing a dialog, refreshing the browser, or following a copied URL cannot lose the planner's
 * place in the distribution workflow.
 */
export function PlannerInvitationWorkspace() {
  const [mode, setMode] = useState<InvitationMode>('guest')

  return (
    <section data-testid="planner-invitation-workspace" className="space-y-4">
      <div className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4 sm:p-5">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/70">
          Invitation operations
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl text-champagne">Invitations & secure QR</h2>
            <p className="mt-1 max-w-3xl font-sans text-xs leading-6 text-champagne/55">
              Prepare and track personal guest invitations, keep the shared printed invitation separate,
              administer Wedding Pass credentials, and manage project-team access.
            </p>
          </div>
          <code className="rounded-lg border border-gold/15 bg-espresso px-2.5 py-1.5 text-[10px] text-gold/70">
            /planner/invitations
          </code>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-gold/15 bg-champagne/[0.025] p-2 sm:grid-cols-3">
        <Button
          type="button"
          variant={mode === 'guest' ? 'default' : 'ghost'}
          onClick={() => setMode('guest')}
          className={mode === 'guest'
            ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light'
            : 'min-h-12 justify-start text-champagne/65 hover:bg-gold/10 hover:text-gold'}
        >
          <Users className="size-4" />
          Guest invitation desk
        </Button>
        <Button
          type="button"
          variant={mode === 'pass' ? 'default' : 'ghost'}
          onClick={() => setMode('pass')}
          className={mode === 'pass'
            ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light'
            : 'min-h-12 justify-start text-champagne/65 hover:bg-gold/10 hover:text-gold'}
        >
          <Ticket className="size-4" />
          Wedding Pass
        </Button>
        <Button
          type="button"
          variant={mode === 'team' ? 'default' : 'ghost'}
          onClick={() => setMode('team')}
          className={mode === 'team'
            ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold/10 hover:text-gold'
            : 'min-h-12 justify-start text-champagne/65 hover:bg-gold/10 hover:text-gold'}
        >
          <UserPlus className="size-4" />
          Project team
        </Button>
      </div>

      {mode === 'guest' ? (
        <div className="space-y-4">
          <PhysicalInvitationQr />
          <InvitationManager />
        </div>
      ) : mode === 'pass' ? (
        <WeddingPassAdministration />
      ) : (
        <PlannerTeamInviteManager />
      )}
    </section>
  )
}

export function PlannerInvitationTools() {
  return (
    <Button
      asChild
      type="button"
      size="sm"
      variant="outline"
      className="gap-1.5 border-gold/30 bg-espresso/95 text-champagne shadow-lg hover:bg-gold/10 hover:text-gold"
    >
      <Link href="/planner/invitations#planner-workspace">
        <QrCode className="size-3.5" />
        <span>Invitations & QR</span>
      </Link>
    </Button>
  )
}
