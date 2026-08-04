'use client'

import { useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { InvitationManager } from '@/components/wedding/invitation-manager'

export function PlannerInvitationTools() {
  const [open, setOpen] = useState(false)

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
          <DialogTitle className="wewed-heading text-3xl">Digital wedding cards, RSVP and QR</DialogTitle>
          <DialogDescription>Design, preview, share, export and rotate guest-specific digital cards and secure RSVP credentials for the selected wedding.</DialogDescription>
          <InvitationManager compact />
        </DialogContent>
      </Dialog>
    </>
  )
}
