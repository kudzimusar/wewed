'use client'

import Link from 'next/link'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PlannerInvitationTools() {
  return (
    <Button
      asChild
      type="button"
      size="sm"
      variant="outline"
      className="gap-1.5 border-gold/30 bg-espresso/95 text-champagne shadow-lg hover:bg-gold/10 hover:text-gold"
    >
      <Link href="/planner/guests/invitations#planner-workspace">
        <QrCode className="size-3.5" />
        <span>Invitations & QR</span>
      </Link>
    </Button>
  )
}
