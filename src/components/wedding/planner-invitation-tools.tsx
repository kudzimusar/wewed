'use client'

import { useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export function PlannerInvitationTools() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function downloadInvitationLinks() {
    setBusy(true)
    try {
      const repair = await fetch('/api/planner/guests/invitations', { method: 'POST' })
      const repairPayload = await repair.json()
      if (!repair.ok || !repairPayload.success) {
        throw new Error(repairPayload.error || 'Unable to prepare invitation links.')
      }

      const response = await fetch('/api/planner/guests/invitations?format=csv', {
        cache: 'no-store',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to export invitation links.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `wewed-rsvp-invitations-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast({
        title: 'Invitation links exported',
        description: repairPayload.generated
          ? `${repairPayload.generated} missing RSVP links were generated first.`
          : 'Every guest already had an RSVP link.',
      })
    } catch (error) {
      toast({
        title: 'Invitation export failed',
        description: error instanceof Error ? error.message : 'Unable to export invitation links.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => void downloadInvitationLinks()}
      className="fixed right-52 top-2 z-[121] gap-1.5 border-gold/30 bg-espresso/95 text-champagne shadow-lg hover:bg-gold/10 hover:text-gold"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
      <span className="hidden lg:inline">RSVP Links</span>
    </Button>
  )
}
