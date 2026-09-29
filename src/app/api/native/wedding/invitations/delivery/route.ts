import { NextRequest } from 'next/server'
import { privateNoStoreJson } from '@/lib/native-private-json'
import { resolveNativeGuestWrite } from '@/lib/native-planner-guest-write'
import { recordInvitationDelivery, resetInvitationDelivery } from '@/lib/planner-invitation-operations'

/**
 * NATIVE-MOBILE-QRO08 — native twin of POST/DELETE /api/planner/guests/invitations/delivery.
 *
 * "Sent" is an explicit Planner record that an invitation was delivered through a channel
 * (whatsapp | email | sms | other). It is an audit event only: no Guest, RSVP or open event is
 * touched, and the device stores nothing — the canonical projection is re-read after each write.
 */
export async function POST(request: NextRequest) {
  const write = await resolveNativeGuestWrite(request)
  if (!write.ok) return write.response
  try {
    const body = (await request.json().catch(() => null)) as { guestIds?: unknown; channel?: unknown } | null
    const result = await recordInvitationDelivery(write.actor, { guestIds: body?.guestIds, channel: body?.channel })
    if (!result.ok) return privateNoStoreJson({ success: false, error: result.error }, result.status)
    return privateNoStoreJson({ success: true, ...result.data })
  } catch (error) {
    console.error('[native invitation delivery POST] failed', error instanceof Error ? error.name : 'unknown')
    return privateNoStoreJson({ success: false, error: 'Unable to record invitation delivery.' }, 500)
  }
}

/** Clears the delivery record (appends an "unmarked" event; history is kept). */
export async function DELETE(request: NextRequest) {
  const write = await resolveNativeGuestWrite(request)
  if (!write.ok) return write.response
  try {
    const body = (await request.json().catch(() => null)) as { guestIds?: unknown } | null
    const result = await resetInvitationDelivery(write.actor, { guestIds: body?.guestIds })
    if (!result.ok) return privateNoStoreJson({ success: false, error: result.error }, result.status)
    return privateNoStoreJson({ success: true, ...result.data })
  } catch (error) {
    console.error('[native invitation delivery DELETE] failed', error instanceof Error ? error.name : 'unknown')
    return privateNoStoreJson({ success: false, error: 'Unable to reset invitation delivery.' }, 500)
  }
}
