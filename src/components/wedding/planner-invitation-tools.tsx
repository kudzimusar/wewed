'use client'

import { useState } from 'react'
import { QrCode, Ticket, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { InvitationManager } from '@/components/wedding/invitation-manager'
import { PhysicalInvitationQr } from '@/components/wedding/physical-invitation-qr'
import { PlannerTeamInviteManager } from '@/components/wedding/planner/planner-team-invite-manager'
import { WeddingPassAdministration } from '@/components/wedding/wedding-pass-administration'

type InvitationMode = 'guest' | 'pass' | 'team'

export function PlannerInvitationTools() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<InvitationMode>('guest')

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-gold/30 bg-espresso/95 text-champagne shadow-lg hover:bg-gold/10 hover:text-gold"
      >
        <QrCode className="size-3.5" />
        <span>Invitations & QR</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-6xl overflow-y-auto border-gold/30 bg-ivory text-espresso">
          <DialogTitle className="wewed-heading text-3xl">Invitations & secure QR</DialogTitle>
          <DialogDescription>
            Each QR has one job and they are kept separate: Printed Invitation Access (shared physical cards), Open Invitation (each guest&apos;s private link and RSVP), Wedding Pass (venue admission) and project-team access. One QR never impersonates another.
          </DialogDescription>

          <div className="mt-2 grid gap-2 rounded-2xl border border-gold/20 bg-white p-2 sm:grid-cols-3">
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
          </div>

          {mode === 'guest' ? (
            <div className="mt-4">
              <PhysicalInvitationQr />
              <div className="mb-4 rounded-xl border border-gold/15 bg-white px-4 py-3">
                <p className="font-medium text-espresso">Open Invitation · Digital wedding cards, RSVP and QR</p>
                <p className="mt-1 text-sm leading-6 text-espresso/60">
                  Personal guest rows below keep their own RSVP credentials and digital cards. They remain separate from the shared Printed Invitation Access QR above, and neither is a Wedding Pass: admission uses the Wedding Pass tab.
                </p>
              </div>
              <InvitationManager compact />
            </div>
          ) : mode === 'pass' ? (
            <div className="mt-4">
              <WeddingPassAdministration />
            </div>
          ) : (
            <div className="mt-4">
              <PlannerTeamInviteManager />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
