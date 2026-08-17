'use client'

import { useState } from 'react'
import { QrCode, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { InvitationManager } from '@/components/wedding/invitation-manager'
import { PlannerTeamInviteManager } from '@/components/wedding/planner/planner-team-invite-manager'

type InvitationMode = 'guest' | 'team'

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
            Guest RSVP credentials and project-team access are separate. Choose what you are inviting someone to do before generating a QR.
          </DialogDescription>

          <div className="mt-2 grid gap-2 rounded-2xl border border-gold/20 bg-white p-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={mode === 'guest' ? 'default' : 'ghost'}
              onClick={() => setMode('guest')}
              className={mode === 'guest' ? 'min-h-12 justify-start bg-gold text-espresso hover:bg-gold-light' : 'min-h-12 justify-start text-espresso/65 hover:bg-ivory'}
            >
              <Users className="size-4" />
              Guest cards, RSVP & guest QR
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
              <p className="mb-4 rounded-xl border border-gold/15 bg-white px-4 py-3 text-sm leading-6 text-espresso/60">
                Use this for wedding guests and RSVP credentials. It does not create Planner, Owner, Coordinator or Viewer access.
              </p>
              <InvitationManager compact />
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
