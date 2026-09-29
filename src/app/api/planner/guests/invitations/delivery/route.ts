import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  INVITATION_DELIVERY_CHANNELS,
  INVITATION_DELIVERY_CLEARED_ACTION,
  INVITATION_DELIVERY_RESOURCE,
  INVITATION_DELIVERY_SENT_ACTION,
  parseInvitationDeliveryAudit,
  type InvitationDeliveryChannel,
} from '@/lib/planner-invitation-delivery'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { loadWeddingChildrenPolicy } from '@/lib/guest-rsvp-mutation'
import { invitationVersionFingerprint } from '@/lib/wedding-guest-session'

const MAX_BATCH = 250

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return noStore(NextResponse.json(body, { status }))
}

function channelFrom(value: unknown): InvitationDeliveryChannel | null {
  return typeof value === 'string' && (INVITATION_DELIVERY_CHANNELS as readonly string[]).includes(value)
    ? value as InvitationDeliveryChannel
    : null
}

function recipientForGuest(
  channel: InvitationDeliveryChannel,
  guest: { name: string; email: string | null; phone: string | null },
): string | null {
  if (channel === 'email') return guest.email
  if (channel === 'whatsapp' || channel === 'sms') return guest.phone
  return guest.email || guest.phone || guest.name
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return noStore(access.error)

  const guestId = request.nextUrl.searchParams.get('guestId')?.trim()
  if (!guestId) return json({ success: false, error: 'Guest ID is required.' }, 400)

  const guest = await db.guest.findFirst({
    where: { id: guestId, weddingId: access.context.weddingId },
    select: { id: true, name: true },
  })
  if (!guest) return json({ success: false, error: 'Guest not found.' }, 404)

  const audits = await db.auditEvent.findMany({
    where: {
      weddingId: access.context.weddingId,
      resourceType: INVITATION_DELIVERY_RESOURCE,
      resourceId: guest.id,
      action: { in: [INVITATION_DELIVERY_SENT_ACTION, INVITATION_DELIVERY_CLEARED_ACTION] },
    },
    select: { action: true, resourceId: true, afterValue: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return json({
    success: true,
    guest: { id: guest.id, name: guest.name },
    data: audits.flatMap((audit) => {
      const parsed = parseInvitationDeliveryAudit(audit)
      return parsed ? [parsed] : []
    }),
  })
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return noStore(access.error)

  const body = (await request.json().catch(() => null)) as {
    action?: unknown
    guestIds?: unknown
    channel?: unknown
  } | null

  const action = body?.action === 'clear_sent' ? 'clear_sent' : body?.action === 'mark_sent' ? 'mark_sent' : null
  if (!action) return json({ success: false, error: 'Choose a supported delivery action.' }, 400)

  const guestIds = Array.from(new Set(
    (Array.isArray(body?.guestIds) ? body!.guestIds : [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ))
  if (guestIds.length === 0 || guestIds.length > MAX_BATCH) {
    return json({ success: false, error: `Select between 1 and ${MAX_BATCH} guests.` }, 400)
  }

  const channel = action === 'mark_sent' ? channelFrom(body?.channel) : null
  if (action === 'mark_sent' && !channel) {
    return json({ success: false, error: 'Choose how the invitation was sent.' }, 400)
  }

  const [guests, wedding, childrenPolicy] = await Promise.all([
    db.guest.findMany({
      where: { weddingId: access.context.weddingId, id: { in: guestIds } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        rsvp: { select: { token: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.wedding.findUnique({
      where: { id: access.context.weddingId },
      select: {
        invitationCardStyle: true,
        invitationCardMessage: true,
        rsvpDeadline: true,
      },
    }),
    loadWeddingChildrenPolicy(access.context.weddingId),
  ])

  if (!wedding || guests.length !== guestIds.length) {
    return json({ success: false, error: 'One or more selected guests were not found in the active wedding.' }, 400)
  }

  if (action === 'mark_sent') {
    const missingLink = guests.filter((guest) => !guest.rsvp?.token)
    if (missingLink.length > 0) {
      return json({
        success: false,
        error: `Generate a private invitation link first for: ${missingLink.map((guest) => guest.name).join(', ')}.`,
      }, 409)
    }

    const missingRecipient = guests.filter((guest) => !recipientForGuest(channel!, guest))
    if (missingRecipient.length > 0) {
      return json({
        success: false,
        error: `Add the required contact detail before marking sent: ${missingRecipient.map((guest) => guest.name).join(', ')}.`,
      }, 409)
    }
  }

  const now = new Date()
  const cardStyle = normalizeInvitationCardStyle(wedding.invitationCardStyle)

  await db.$transaction(guests.map((guest) => {
    if (action === 'clear_sent') {
      return db.auditEvent.create({
        data: {
          action: INVITATION_DELIVERY_CLEARED_ACTION,
          resourceType: INVITATION_DELIVERY_RESOURCE,
          resourceId: guest.id,
          afterValue: JSON.stringify({
            reason: 'planner_correction',
            clearedAt: now.toISOString(),
          }),
          weddingId: access.context.weddingId,
          actorId: access.context.session.userId,
        },
      })
    }

    const token = guest.rsvp!.token
    return db.auditEvent.create({
      data: {
        action: INVITATION_DELIVERY_SENT_ACTION,
        resourceType: INVITATION_DELIVERY_RESOURCE,
        resourceId: guest.id,
        afterValue: JSON.stringify({
          channel,
          recipient: recipientForGuest(channel!, guest),
          cardStyle,
          invitationMessage: wedding.invitationCardMessage,
          rsvpDeadline: wedding.rsvpDeadline?.toISOString() ?? null,
          childrenPolicy,
          invitationFingerprint: invitationVersionFingerprint({
            weddingId: access.context.weddingId,
            guestId: guest.id,
            rsvpToken: token,
          }),
          messageTemplate: 'wewed-personal-invitation-v1',
          sentAt: now.toISOString(),
        }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })
  }))

  return json({
    success: true,
    action,
    count: guests.length,
    guestIds: guests.map((guest) => guest.id),
  })
}
