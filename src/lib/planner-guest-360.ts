import 'server-only'

import { db } from '@/lib/db'
import { loadPlannerInvitationProjection } from '@/lib/planner-invitation-projection'

export async function loadPlannerGuest360(
  weddingId: string,
  guestId: string,
  siteUrl: string,
) {
  const invitationProjection = await loadPlannerInvitationProjection(weddingId, siteUrl)
  if (!invitationProjection) return null

  const invitation = invitationProjection.data.find((row) => row.id === guestId)
  if (!invitation) return null

  const [guest, serviceMembership, checkIns] = await Promise.all([
    db.guest.findFirst({
      where: { id: guestId, weddingId },
      include: {
        rsvp: true,
        seatingTable: { select: { id: true, name: true, capacity: true } },
      },
    }),
    db.serviceTeamMember.findFirst({
      where: { guestId, weddingId },
      include: {
        serviceTeam: {
          include: {
            serviceEngagement: {
              include: {
                vendor: { select: { id: true, name: true, category: true } },
              },
            },
          },
        },
      },
    }),
    db.weddingCheckIn.findMany({
      where: { guestId, weddingId, eventKey: 'wedding-day' },
      include: {
        gate: { select: { id: true, name: true } },
        admittedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { admittedAt: 'asc' },
    }),
  ])

  if (!guest) return null

  return {
    guestId: guest.id,
    identity: {
      name: guest.name,
      role: guest.role,
      roleDetail: guest.roleDetail,
      relationshipSide: guest.side,
      attendanceAllocation: guest.attendanceAllocation,
      serviceProvider: serviceMembership
        ? {
            teamId: serviceMembership.serviceTeamId,
            teamName: serviceMembership.serviceTeam.name,
            company: serviceMembership.serviceTeam.companyName,
            vendorId: serviceMembership.serviceTeam.serviceEngagement.vendor.id,
            vendorName: serviceMembership.serviceTeam.serviceEngagement.vendor.name,
            serviceCategory: serviceMembership.serviceTeam.serviceCategory,
            function: serviceMembership.function,
            isLeader: serviceMembership.isLeader,
            rosterStatus: serviceMembership.serviceTeam.rosterStatus,
            submitted: Boolean(serviceMembership.submittedAt),
            approved: Boolean(serviceMembership.approvedAt),
          }
        : null,
    },
    contact: {
      email: guest.email,
      phone: guest.phone,
      missing: !guest.email && !guest.phone,
    },
    invitation: {
      url: invitation.invitationUrl,
      shareMessage: invitation.shareMessage,
      deliveryStatus: invitation.deliveryStatus,
      deliveryChannel: invitation.deliveryChannel,
      deliveredAt: invitation.deliveredAt,
      deliveredBy: invitation.deliveredBy,
      openedAt: invitation.openedAt,
    },
    rsvp: {
      status: invitation.status,
      attending: guest.rsvp?.attending ?? null,
      mealChoice: guest.rsvp?.mealChoice ?? null,
      dietaryNotes: guest.rsvp?.dietaryNotes ?? null,
      message: guest.rsvp?.message ?? null,
      plusOne: guest.rsvp?.plusOne ?? false,
      plusOneName: guest.rsvp?.plusOneName ?? null,
      kidsAttending: guest.rsvp?.kidsAttending ?? false,
      kidsCount: guest.rsvp?.kidsCount ?? 0,
      updatedAt: guest.rsvp?.updatedAt.toISOString() ?? null,
    },
    nativeActivation: {
      active: invitation.nativeActivated,
      platforms: invitation.nativePlatforms,
      lastSeenAt: invitation.nativeLastSeenAt,
      clients: invitation.nativeClients,
    },
    seating: {
      tableId: guest.seatingTableId,
      tableName: guest.seatingTable?.name ?? null,
      tableNumber: guest.tableNumber,
      tableCapacity: guest.seatingTable?.capacity ?? null,
    },
    weddingPass: {
      state: invitation.passState,
    },
    checkIn: {
      checkedIn: invitation.checkedIn,
      count: checkIns.length,
      records: checkIns.map((record) => ({
        id: record.id,
        attendeeKey: record.attendeeKey,
        attendeeKind: record.attendeeKind,
        attendeeName: record.attendeeName,
        source: record.source,
        admittedAt: record.admittedAt.toISOString(),
        gate: record.gate,
        admittedBy: {
          id: record.admittedByUser.id,
          name: record.admittedByUser.name,
          email: record.admittedByUser.email,
        },
      })),
    },
  }
}
