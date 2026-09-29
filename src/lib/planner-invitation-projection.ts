import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import {
  buildDigitalInvitationMessage,
  normalizeInvitationCardStyle,
} from '@/lib/digital-invitation-card'
import { buildSmartInvitationUrl } from '@/lib/invitation-links'
import {
  formatPhysicalInvitationCode,
  physicalInvitationCodeFromDestinationId,
} from '@/lib/physical-invitation-code'

/**
 * Canonical Planner/Couple invitation read projections (QRO05-PIQR01).
 *
 * The desktop Planner routes (`/api/planner/guests/invitations`, `/…/physical`) and the native
 * account routes (`/api/native/wedding/invitations`, `/…/physical`) read the SAME truth through
 * these functions, so the two surfaces cannot drift into separate Prisma interpretations.
 *
 * Read-only by construction: nothing here issues, backfills or rotates an invitation token, and
 * nothing creates a physical QR destination.
 *
 * `invitationUrl`/`qrValue`/`shareMessage` carry each Guest's private RSVP credential. Callers must
 * treat them as credential-bearing: never log them, never persist them into a general graph.
 */

export type ChildrenPolicy = 'welcome' | 'adults_only'

export const CANONICAL_WEWED_ORIGIN = 'https://wewed.pro'

export function normalizeChildrenPolicy(value: unknown): ChildrenPolicy {
  return value === 'adults_only' ? 'adults_only' : 'welcome'
}

/**
 * Stable one-way marker for the exact personal invitation link version that was handed off.
 * It lets the Planner warn that a link was rotated after sending without storing/logging the
 * private RSVP credential itself.
 */
export function invitationDeliveryVersionFingerprint(rsvpToken: string): string {
  return createHash('sha256')
    .update(`wewed.invitation.delivery.v1:${rsvpToken}`)
    .digest('base64url')
}

export function invitationWeddingSelect() {
  return {
    slug: true,
    title: true,
    monogram: true,
    tagline: true,
    date: true,
    venue: true,
    venueCity: true,
    venueCountry: true,
    primaryColor: true,
    accentColor: true,
    backgroundColor: true,
    invitationCardStyle: true,
    invitationCardMessage: true,
    rsvpDeadline: true,
  } as const
}

export type PlannerInvitationStatus = 'attending' | 'declined' | 'pending'

/**
 * The wedding's invitation design plus one row per Guest (name-ordered). `siteUrl` is the origin
 * the caller was reached on — the desktop route and the native route both pass their own request
 * origin, exactly as the desktop Planner has always done.
 */
export async function loadPlannerInvitationProjection(weddingId: string, siteUrl: string) {
  const [wedding, guests, childrenPolicyRow, deliveries] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: invitationWeddingSelect(),
    }),
    db.guest.findMany({
      where: { weddingId },
      include: { rsvp: { select: { token: true, attending: true, checkedIn: true } } },
      orderBy: { name: 'asc' },
    }),
    db.weddingContent.findUnique({
      where: {
        weddingId_section_field: {
          weddingId,
          section: 'rsvp',
          field: 'childrenPolicy',
        },
      },
      select: { value: true },
    }),
    db.guestInvitationDelivery.findMany({
      where: { weddingId },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        guestId: true,
        channel: true,
        recipient: true,
        sentAt: true,
        invitationVersionFingerprint: true,
        invitationStyle: true,
        invitationMessage: true,
        rsvpDeadline: true,
        childrenPolicy: true,
      },
    }),
  ])

  if (!wedding) return null

  const style = normalizeInvitationCardStyle(wedding.invitationCardStyle)
  const childrenPolicy = normalizeChildrenPolicy(childrenPolicyRow?.value)
  const origin = siteUrl.replace(/\/$/, '')
  const missingTokens = guests.filter((guest) => !guest.rsvp?.token).length
  const deliveryCountByGuest = new Map<string, number>()
  const latestDeliveryByGuest = new Map<string, (typeof deliveries)[number]>()
  for (const delivery of deliveries) {
    deliveryCountByGuest.set(
      delivery.guestId,
      (deliveryCountByGuest.get(delivery.guestId) ?? 0) + 1,
    )
    if (!latestDeliveryByGuest.has(delivery.guestId)) {
      latestDeliveryByGuest.set(delivery.guestId, delivery)
    }
  }

  const data = guests.map((guest) => {
    const invitationUrl = guest.rsvp?.token
      ? buildSmartInvitationUrl({
          siteUrl: origin,
          weddingSlug: wedding.slug,
          token: guest.rsvp.token,
          style,
        })
      : null
    const status: PlannerInvitationStatus =
      guest.rsvp?.attending === true
        ? 'attending'
        : guest.rsvp?.attending === false
          ? 'declined'
          : 'pending'
    const latestDelivery = latestDeliveryByGuest.get(guest.id)
    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      tableNumber: guest.tableNumber,
      status,
      checkedIn: guest.rsvp?.checkedIn ?? false,
      deliveryCount: deliveryCountByGuest.get(guest.id) ?? 0,
      lastSentAt: latestDelivery?.sentAt.toISOString() ?? null,
      lastSentVia: latestDelivery?.channel ?? null,
      lastSentRecipient: latestDelivery?.recipient ?? null,
      lastSentInvitationStyle: latestDelivery?.invitationStyle ?? null,
      lastSentInvitationMessage: latestDelivery?.invitationMessage ?? null,
      lastSentRsvpDeadline: latestDelivery?.rsvpDeadline?.toISOString() ?? null,
      lastSentChildrenPolicy: latestDelivery?.childrenPolicy ?? null,
      lastSentLinkCurrent: latestDelivery && guest.rsvp?.token
        ? latestDelivery.invitationVersionFingerprint === invitationDeliveryVersionFingerprint(guest.rsvp.token)
        : latestDelivery ? false : null,
      invitationUrl,
      qrValue: invitationUrl,
      shareMessage: invitationUrl
        ? buildDigitalInvitationMessage({
            guestName: guest.name,
            weddingTitle: wedding.title,
            invitationUrl,
          })
        : null,
    }
  })

  return {
    wedding: { ...wedding, invitationCardStyle: style, childrenPolicy },
    count: data.length,
    missingTokens,
    data,
  }
}

/** Printed Invitation Access: the wedding's active shared physical-invitation QR destination. */
export async function loadPhysicalInvitationProjection(weddingId: string) {
  const [wedding, invitedCount, destination] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: { slug: true, title: true },
    }),
    db.guest.count({ where: { weddingId } }),
    db.qRDestination.findFirst({
      where: {
        weddingId,
        type: 'physical_invitation',
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scanCount: true,
        createdAt: true,
      },
    }),
  ])

  if (!wedding) return null

  const code = destination
    ? physicalInvitationCodeFromDestinationId(destination.id)
    : null

  return {
    wedding: { slug: wedding.slug, title: wedding.title },
    configured: Boolean(destination && code),
    code: code ? formatPhysicalInvitationCode(code) : null,
    rawCode: code,
    accessUrl: code ? `${CANONICAL_WEWED_ORIGIN}/i/${code}` : null,
    scanCount: destination?.scanCount ?? 0,
    invitedCount,
    createdAt: destination?.createdAt?.toISOString() ?? null,
  }
}
