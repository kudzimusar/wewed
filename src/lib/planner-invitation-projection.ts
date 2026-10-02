import { db } from '@/lib/db'
import {
  buildDigitalInvitationMessage,
  normalizeInvitationCardStyle,
} from '@/lib/digital-invitation-card'
import { buildSmartInvitationUrl } from '@/lib/invitation-links'
import { normalizeAdditionalAdultPolicy } from '@/lib/invitation-content-contract'
import {
  resolveWeddingPassCredentialAdminState,
  type WeddingPassCredentialAdminState,
} from '@/lib/wedding-pass-availability'
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
export type InvitationDeliveryChannel = 'whatsapp' | 'email' | 'sms' | 'other'

interface InvitationDeliveryState {
  status: 'sent' | 'not_sent'
  channel: InvitationDeliveryChannel | null
  sentAt: string | null
  sentBy: string | null
}

function deliveryStateFromAudit(input: {
  action: string
  afterValue: string | null
  createdAt: Date
  actor: { name: string | null; email: string } | null
}): InvitationDeliveryState {
  if (input.action !== 'guest.invitation_delivery_marked') {
    return { status: 'not_sent', channel: null, sentAt: null, sentBy: null }
  }

  let channel: InvitationDeliveryChannel | null = null
  try {
    const parsed = JSON.parse(input.afterValue || '{}') as { channel?: unknown }
    if (['whatsapp', 'email', 'sms', 'other'].includes(String(parsed.channel))) {
      channel = parsed.channel as InvitationDeliveryChannel
    }
  } catch {
    channel = null
  }

  return {
    status: 'sent',
    channel,
    sentAt: input.createdAt.toISOString(),
    sentBy: input.actor?.name?.trim() || input.actor?.email || null,
  }
}

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

export interface PlannerAttendanceSummary {
  registered: number
  sent: number
  notSent: number
  opened: number
  responded: number
  responseRate: number
  attending: number
  declined: number
  awaiting: number
  expectedNamedAttendees: number
  checkedIn: number
  notYetArrived: number
  missingContact: number
  passPendingRsvp: number
  passDeclined: number
  passNotYetIssuable: number
  passNotYetIssued: number
  passActive: number
  passRevoked: number
  passSuperseded: number
  passIssuanceClosed: number
  nativeInstallClicked: number
  nativeInstallNotActivated: number
  nativeInstallToActivationRate: number
  nativeActivated: number
  nativeActivationRate: number
  nativeAndroid: number
  nativeIos: number
}

export function buildPlannerAttendanceSummary(rows: Array<{
  status: PlannerInvitationStatus
  deliveryStatus: 'sent' | 'not_sent'
  openedAt: string | null
  checkedIn: boolean
  email: string | null
  phone: string | null
  passState: WeddingPassCredentialAdminState
  nativeInstallClickedAt?: string | null
  nativeActivated?: boolean
  nativePlatforms?: string[]
}>): PlannerAttendanceSummary {
  const registered = rows.length
  const attending = rows.filter((row) => row.status === 'attending').length
  const declined = rows.filter((row) => row.status === 'declined').length
  const responded = attending + declined
  const checkedIn = rows.filter((row) => row.checkedIn).length
  const nativeInstallClicked = rows.filter((row) => Boolean(row.nativeInstallClickedAt)).length
  const nativeInstallActivated = rows.filter(
    (row) => Boolean(row.nativeInstallClickedAt) && row.nativeActivated,
  ).length
  const nativeActivated = rows.filter((row) => row.nativeActivated).length
  return {
    registered,
    sent: rows.filter((row) => row.deliveryStatus === 'sent').length,
    notSent: rows.filter((row) => row.deliveryStatus === 'not_sent').length,
    opened: rows.filter((row) => Boolean(row.openedAt)).length,
    responded,
    responseRate: registered > 0 ? responded / registered : 0,
    attending,
    declined,
    awaiting: rows.filter((row) => row.status === 'pending').length,
    // Named-person attendance counts canonical Guest identities only; never anonymous household extras.
    expectedNamedAttendees: attending,
    checkedIn,
    notYetArrived: Math.max(0, attending - checkedIn),
    missingContact: rows.filter((row) => !row.email && !row.phone).length,
    passPendingRsvp: rows.filter((row) => row.passState === 'pending_rsvp').length,
    passDeclined: rows.filter((row) => row.passState === 'declined').length,
    passNotYetIssuable: rows.filter((row) => row.passState === 'not_yet_issuable').length,
    passNotYetIssued: rows.filter((row) => row.passState === 'not_yet_issued').length,
    passActive: rows.filter((row) => row.passState === 'active').length,
    passRevoked: rows.filter((row) => row.passState === 'revoked').length,
    passSuperseded: rows.filter((row) => row.passState === 'superseded').length,
    passIssuanceClosed: rows.filter((row) => row.passState === 'issuance_closed').length,
    nativeInstallClicked,
    nativeInstallNotActivated: rows.filter(
      (row) => Boolean(row.nativeInstallClickedAt) && !row.nativeActivated,
    ).length,
    nativeInstallToActivationRate:
      nativeInstallClicked > 0 ? nativeInstallActivated / nativeInstallClicked : 0,
    nativeActivated,
    nativeActivationRate: registered > 0 ? nativeActivated / registered : 0,
    nativeAndroid: rows.filter((row) => row.nativePlatforms?.includes('android')).length,
    nativeIos: rows.filter((row) => row.nativePlatforms?.includes('ios')).length,
  }
}

/**
 * The wedding's invitation design plus one row per Guest (name-ordered). `siteUrl` is the origin
 * the caller was reached on — the desktop route and the native route both pass their own request
 * origin, exactly as the desktop Planner has always done.
 */
export async function loadPlannerInvitationProjection(weddingId: string, siteUrl: string) {
  const [wedding, guests, tables, childrenPolicyRow, additionalAdultPolicyRow, deliveryEvents, passCredentials, nativePresences] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: invitationWeddingSelect(),
    }),
    db.guest.findMany({
      where: { weddingId },
      include: {
        rsvp: { select: { token: true, attending: true, checkedIn: true } },
        seatingTable: { select: { id: true, name: true, capacity: true } },
        serviceTeamMemberships: { select: { approvedAt: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.seatingTable.findMany({
      where: { weddingId },
      select: { id: true, name: true, capacity: true },
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
    db.weddingContent.findUnique({
      where: {
        weddingId_section_field: {
          weddingId,
          section: 'rsvp',
          field: 'additionalAdultPolicy',
        },
      },
      select: { value: true },
    }),
    db.auditEvent.findMany({
      where: {
        weddingId,
        resourceType: 'guest_invitation',
        action: {
          in: [
            'guest.invitation_delivery_marked',
            'guest.invitation_delivery_unmarked',
            'guest.invitation_opened',
            'guest.native_install_clicked',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        resourceId: true,
        afterValue: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    db.weddingPassCredential.findMany({
      where: { weddingId },
      select: {
        guestId: true,
        issueSeq: true,
        revokedAt: true,
        revocationReason: true,
        supersededAt: true,
        expiresAt: true,
      },
      orderBy: [{ guestId: 'asc' }, { issueSeq: 'desc' }],
    }),
    db.guestNativePresence.findMany({
      where: { weddingId },
      select: {
        guestId: true,
        platform: true,
        appVersion: true,
        buildVersion: true,
        firstActivatedAt: true,
        lastSeenAt: true,
        lastInvitationOpenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    }),
  ])

  if (!wedding) return null

  const style = normalizeInvitationCardStyle(wedding.invitationCardStyle)
  const childrenPolicy = normalizeChildrenPolicy(childrenPolicyRow?.value)
  const additionalAdultPolicy = normalizeAdditionalAdultPolicy(additionalAdultPolicyRow?.value)
  const origin = siteUrl.replace(/\/$/, '')
  const missingTokens = guests.filter((guest) => !guest.rsvp?.token).length
  const deliveryByGuest = new Map<string, InvitationDeliveryState>()
  const openedAtByGuest = new Map<string, string>()
  const nativeInstallClickedAtByGuest = new Map<string, string>()
  const latestPassByGuest = new Map<string, (typeof passCredentials)[number]>()
  for (const credential of passCredentials) {
    if (!latestPassByGuest.has(credential.guestId)) latestPassByGuest.set(credential.guestId, credential)
  }
  const nativePresenceByGuest = new Map<string, typeof nativePresences>()
  for (const presence of nativePresences) {
    const current = nativePresenceByGuest.get(presence.guestId) ?? []
    current.push(presence)
    nativePresenceByGuest.set(presence.guestId, current)
  }
  for (const event of deliveryEvents) {
    if (!event.resourceId) continue
    if (event.action === 'guest.invitation_opened') {
      if (!openedAtByGuest.has(event.resourceId)) {
        openedAtByGuest.set(event.resourceId, event.createdAt.toISOString())
      }
      continue
    }
    if (event.action === 'guest.native_install_clicked') {
      if (!nativeInstallClickedAtByGuest.has(event.resourceId)) {
        nativeInstallClickedAtByGuest.set(event.resourceId, event.createdAt.toISOString())
      }
      continue
    }
    if (!deliveryByGuest.has(event.resourceId)) {
      deliveryByGuest.set(event.resourceId, deliveryStateFromAudit(event))
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
    const delivery = deliveryByGuest.get(guest.id) ?? {
      status: 'not_sent' as const,
      channel: null,
      sentAt: null,
      sentBy: null,
    }
    const passState = resolveWeddingPassCredentialAdminState({
      attending: guest.rsvp?.attending ?? null,
      weddingDate: wedding.date,
      latest: latestPassByGuest.get(guest.id) ?? null,
      admissionApproved: guest.role === 'service_provider'
        ? guest.serviceTeamMemberships.some((membership) => Boolean(membership.approvedAt))
        : true,
    })
    const nativeClients = (nativePresenceByGuest.get(guest.id) ?? []).map((presence) => ({
      platform: presence.platform,
      appVersion: presence.appVersion,
      buildVersion: presence.buildVersion,
      firstActivatedAt: presence.firstActivatedAt.toISOString(),
      lastSeenAt: presence.lastSeenAt.toISOString(),
      lastInvitationOpenAt: presence.lastInvitationOpenAt?.toISOString() ?? null,
    }))
    return {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      role: guest.role,
      roleDetail: guest.roleDetail,
      side: guest.side,
      attendanceAllocation: guest.attendanceAllocation,
      seatingTableId: guest.seatingTableId,
      seatingTableName: guest.seatingTable?.name ?? null,
      tableNumber: guest.tableNumber,
      status,
      checkedIn: guest.rsvp?.checkedIn ?? false,
      passState,
      nativeInstallClickedAt: nativeInstallClickedAtByGuest.get(guest.id) ?? null,
      nativeActivated: nativeClients.length > 0,
      nativePlatforms: nativeClients.map((client) => client.platform),
      nativeLastSeenAt: nativeClients[0]?.lastSeenAt ?? null,
      nativeClients,
      invitationUrl,
      qrValue: invitationUrl,
      shareMessage: invitationUrl
        ? buildDigitalInvitationMessage({
            guestName: guest.name,
            weddingTitle: wedding.title,
            invitationUrl,
          })
        : null,
      deliveryStatus: delivery.status,
      deliveryChannel: delivery.channel,
      deliveredAt: delivery.sentAt,
      deliveredBy: delivery.sentBy,
      openedAt: openedAtByGuest.get(guest.id) ?? null,
    }
  })

  const summary = buildPlannerAttendanceSummary(data)

  return {
    wedding: { ...wedding, invitationCardStyle: style, childrenPolicy, additionalAdultPolicy },
    count: data.length,
    missingTokens,
    tables,
    summary,
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
