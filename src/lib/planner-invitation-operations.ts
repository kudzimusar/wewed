import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import type { InvitationDeliveryChannel } from '@/lib/planner-invitation-projection'

/**
 * NATIVE-MOBILE-QRO08 — the ONE implementation of the Planner invitation write operations.
 *
 * The desktop routes under /api/planner/guests/invitations (cookie session) and the native routes
 * under /api/native/wedding/invitations (Bearer native account session + grant) are two front doors
 * to these same functions, so both clients write the same rows and the canonical projection
 * (`loadPlannerInvitationProjection`) reads them back identically. Nothing here knows which client
 * called it: callers resolve authority and pass the wedding and the acting user.
 *
 * Delivery tracking is an audit trail only. It never touches Guest, RSVP or open events: "sent"
 * means a Planner explicitly recorded a delivery; "opened" is written only when a genuine personal
 * credential is redeemed (see guest-invitation-telemetry).
 */

export const INVITATION_DELIVERY_CHANNELS = new Set<InvitationDeliveryChannel>(['whatsapp', 'email', 'sms', 'other'])
export const INVITATION_DELIVERY_MAX_BATCH = 500

export type OperationResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string }

export interface InvitationOperationActor {
  weddingId: string
  actorId: string
}

export function cleanInvitationGuestIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
}

export function parseInvitationDeliveryChannel(value: unknown): InvitationDeliveryChannel | null {
  return typeof value === 'string' && INVITATION_DELIVERY_CHANNELS.has(value as InvitationDeliveryChannel)
    ? value as InvitationDeliveryChannel
    : null
}

async function guestsBelongToWedding(weddingId: string, guestIds: string[]): Promise<boolean> {
  const guests = await db.guest.findMany({
    where: { weddingId, id: { in: guestIds } },
    select: { id: true },
  })
  return guests.length === guestIds.length
}

export async function recordInvitationDelivery(
  actor: InvitationOperationActor,
  input: { guestIds: unknown; channel: unknown },
): Promise<OperationResult<{ count: number; channel: InvitationDeliveryChannel; sentAt: string }>> {
  const guestIds = cleanInvitationGuestIds(input.guestIds)
  const channel = parseInvitationDeliveryChannel(input.channel)

  if (guestIds.length === 0 || guestIds.length > INVITATION_DELIVERY_MAX_BATCH) {
    return { ok: false, status: 400, error: `Select between 1 and ${INVITATION_DELIVERY_MAX_BATCH} guests.` }
  }
  if (!channel) {
    return { ok: false, status: 400, error: 'Choose how the invitation was sent.' }
  }
  if (!(await guestsBelongToWedding(actor.weddingId, guestIds))) {
    return { ok: false, status: 400, error: 'One or more selected guests are not part of the active wedding.' }
  }

  const sentAt = new Date()
  await db.auditEvent.createMany({
    data: guestIds.map((guestId) => ({
      action: 'guest.invitation_delivery_marked',
      resourceType: 'guest_invitation',
      resourceId: guestId,
      afterValue: JSON.stringify({ channel, sentAt: sentAt.toISOString() }),
      weddingId: actor.weddingId,
      actorId: actor.actorId,
    })),
  })

  return { ok: true, status: 200, data: { count: guestIds.length, channel, sentAt: sentAt.toISOString() } }
}

export async function resetInvitationDelivery(
  actor: InvitationOperationActor,
  input: { guestIds: unknown },
): Promise<OperationResult<{ count: number }>> {
  const guestIds = cleanInvitationGuestIds(input.guestIds)
  if (guestIds.length === 0 || guestIds.length > INVITATION_DELIVERY_MAX_BATCH) {
    return { ok: false, status: 400, error: `Select between 1 and ${INVITATION_DELIVERY_MAX_BATCH} guests.` }
  }
  if (!(await guestsBelongToWedding(actor.weddingId, guestIds))) {
    return { ok: false, status: 400, error: 'One or more selected guests are not part of the active wedding.' }
  }

  await db.auditEvent.createMany({
    data: guestIds.map((guestId) => ({
      action: 'guest.invitation_delivery_unmarked',
      resourceType: 'guest_invitation',
      resourceId: guestId,
      afterValue: JSON.stringify({ clearedAt: new Date().toISOString() }),
      weddingId: actor.weddingId,
      actorId: actor.actorId,
    })),
  })

  return { ok: true, status: 200, data: { count: guestIds.length } }
}

/** Issues a personal link only for guests that have none. Never replaces an existing link. */
export async function repairMissingInvitationLinks(
  actor: InvitationOperationActor,
): Promise<OperationResult<{ generated: number }>> {
  const guests = await db.guest.findMany({
    where: { weddingId: actor.weddingId, rsvp: null },
    select: { id: true },
  })
  if (guests.length) {
    await db.rSVP.createMany({
      data: guests.map((guest) => ({ guestId: guest.id, token: randomUUID() })),
      skipDuplicates: true,
    })
    await db.auditEvent.create({
      data: {
        action: 'guest.invitation_links_repair',
        resourceType: 'rsvp',
        afterValue: JSON.stringify({ generated: guests.length }),
        weddingId: actor.weddingId,
        actorId: actor.actorId,
      },
    })
  }
  return { ok: true, status: 200, data: { generated: guests.length } }
}

/** Destructive: the Guest's previous personal link stops working immediately. */
export async function rotateGuestInvitation(
  actor: InvitationOperationActor,
  input: { guestId: unknown },
): Promise<OperationResult<Record<string, never>>> {
  const guestId = typeof input.guestId === 'string' ? input.guestId : ''
  if (!guestId) return { ok: false, status: 400, error: 'Guest ID is required.' }

  const guest = await db.guest.findFirst({
    where: { id: guestId, weddingId: actor.weddingId },
    include: { rsvp: { select: { id: true, token: true } } },
  })
  if (!guest) return { ok: false, status: 404, error: 'Guest not found.' }

  const token = randomUUID()
  if (guest.rsvp) {
    await db.rSVP.update({ where: { id: guest.rsvp.id }, data: { token } })
  } else {
    await db.rSVP.create({ data: { guestId: guest.id, token } })
  }

  await db.auditEvent.create({
    data: {
      action: 'guest.invitation_rotated',
      resourceType: 'rsvp',
      resourceId: guest.id,
      beforeValue: JSON.stringify({ tokenPresent: Boolean(guest.rsvp?.token) }),
      afterValue: JSON.stringify({ rotated: true }),
      weddingId: actor.weddingId,
      actorId: actor.actorId,
    },
  })

  return { ok: true, status: 200, data: {} }
}
