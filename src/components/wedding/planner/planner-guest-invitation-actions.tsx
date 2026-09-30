'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Send, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type PlannerInvitationDeliveryChannel = 'whatsapp' | 'email' | 'sms' | 'other'

export interface PlannerGuestInvitationActionData {
  id: string
  name: string
  invitationUrl: string | null
  shareMessage: string | null
  deliveryStatus: 'sent' | 'not_sent'
}

function previewLink(value: string): string {
  try {
    const url = new URL(value)
    url.searchParams.set('plannerPreview', '1')
    return url.toString()
  } catch {
    return value
  }
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
}

export function PlannerGuestInvitationActions({
  guest,
  disabled = false,
  compact = false,
  initialChannel = 'whatsapp',
  onDeliveryChanged,
}: {
  guest: PlannerGuestInvitationActionData
  disabled?: boolean
  compact?: boolean
  initialChannel?: PlannerInvitationDeliveryChannel
  onDeliveryChanged?: () => void | Promise<void>
}) {
  const [channel, setChannel] = useState<PlannerInvitationDeliveryChannel>(initialChannel)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<'message' | 'link' | 'invite' | null>(null)
  const canInvite = Boolean(guest.invitationUrl && guest.shareMessage)

  function remember(kind: 'message' | 'link' | 'invite') {
    setCopied(kind)
    window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1800)
  }

  async function invite() {
    if (!guest.shareMessage) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Wewed · Invitation for ${guest.name}`,
          text: guest.shareMessage,
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    await copyText(guest.shareMessage)
    remember('invite')
  }

  async function recordDelivery(markSent: boolean) {
    setBusy(true)
    try {
      const response = await fetch('/api/planner/guests/invitations/delivery', {
        method: markSent ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          markSent
            ? { guestIds: [guest.id], channel }
            : { guestIds: [guest.id] },
        ),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to update invitation delivery.')
      }
      await onDeliveryChanged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-testid={`guest-invitation-actions-${guest.id}`}
      className={`flex flex-wrap items-center gap-2 ${compact ? 'mt-2' : 'mt-4'}`}
    >
      <Button type="button" size="sm" onClick={() => void invite()} disabled={disabled || !canInvite}>
        <Share2 className="size-4" />
        {copied === 'invite' ? 'Invite copied' : 'Invite / Share'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || !guest.shareMessage}
        onClick={() => {
          if (!guest.shareMessage) return
          void copyText(guest.shareMessage).then(() => remember('message'))
        }}
      >
        {copied === 'message' ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied === 'message' ? 'Message copied' : 'Copy message'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || !guest.invitationUrl}
        onClick={() => {
          if (!guest.invitationUrl) return
          void copyText(guest.invitationUrl).then(() => remember('link'))
        }}
      >
        {copied === 'link' ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied === 'link' ? 'Link copied' : 'Copy link'}
      </Button>
      {guest.invitationUrl && (
        <Button asChild size="sm" variant="outline">
          <a href={previewLink(guest.invitationUrl)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Preview
          </a>
        </Button>
      )}
      <select
        value={channel}
        onChange={(event) => setChannel(event.target.value as PlannerInvitationDeliveryChannel)}
        className="h-9 rounded-md border border-gold/20 bg-white px-2 text-xs text-espresso"
        aria-label={`Delivery channel for ${guest.name}`}
        disabled={disabled || busy}
      >
        <option value="whatsapp">WhatsApp</option>
        <option value="email">Email</option>
        <option value="sms">SMS</option>
        <option value="other">Other</option>
      </select>
      {guest.deliveryStatus === 'sent' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => void recordDelivery(false)}
        >
          Reset sent
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => void recordDelivery(true)}
        >
          <Send className="size-4" />
          Mark sent
        </Button>
      )}
    </div>
  )
}
