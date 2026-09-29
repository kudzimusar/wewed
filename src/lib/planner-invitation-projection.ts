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
  const [wedding, guests, childrenPolicyRow, deliveryEvents] = await Promise.all([
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
    db.auditEvent.findMany({
      where: {
        weddingId,
        resourceType: 'Guest',
        action: {
          in: [
            'guest.invitation_marked_sent',
            'guest.invitation_opened',
            'guest.invitation_delivery_reset',
          ],
        },
      },
      select: {
        action: true,
        resourceId: true,
        afterValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!wedding) return null

  const style = normalizeInvitationCardStyle(wedding.invitationCardStyle)
  const childrenPolicy = normalizeChildrenPolicy(childrenPolicyRow?.value)
  const origin = siteUrl.replace(/\/$/, '')
  const missingTokens = guests.filter((guest) => !guest.rsvp?.token).length

  const deliveryByGuest = new Map<string, {
    resetAt: Date | null
    sentAt: Date | null
    sentChannel: string | null
    openedAt: Date | null
  }>()
  for (const event of deliveryEvents) {
    if (!event.resourceId) continue
    const current = deliveryByGuest.get(event.resourceId) ?? {
      resetAt: null,
      sentAt: null,
      sentChannel: null,
      openedAt: null,
    }
    if (event.action === 'guest.invitation_delivery_reset') {
      current.resetAt = event.createdAt
      current.sentAt = null
      current.sentChannel = null
      current.openedAt = null
    } else if (event.action === 'guest.invitation_marked_sent') {
      current.sentAt = event.createdAt
      try {
        const value = event.afterValue ? JSON.parse(event.afterValue) as { channel?: unknown } : null
        current.sentChannel = typeof value?.channel === 'string' ? value.channel : null
      } catch {
        current.sentChannel = null
      }
    } else if (event.action === 'guest.invitation_opened') {
      current.openedAt = event.createdAt
    }
    deliveryByGuest.set(event.resourceId, current)
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
    const delivery = deliveryByGuest.get(guest.id)
    const deliveryStatus = delivery?.openedAt
      ? 'opened'
      : delivery?.sentAt
        ? 'sent'
        : 'not_sent'

    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      tableNumber: guest.tableNumber,
      status,
      checkedIn: guest.rsvp?.checkedIn ?? false,
      invitationUrl,
      qrValue: invitationUrl,
      shareMessage: invitationUrl
        ? buildDigitalInvitationMessage({
            guestName: guest.name,
            weddingTitle: wedding.title,
            invitationUrl,
          })
        : null,
      delivery: {
        status: deliveryStatus,
        sentAt: delivery?.sentAt?.toISOString() ?? null,
        sentChannel: delivery?.sentChannel ?? null,
        openedAt: delivery?.openedAt?.toISOString() ?? null,
      },
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
