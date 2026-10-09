import 'server-only'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { createPlannerGuest, cleanGuestText } from '@/lib/planner-guest-operations'
import { assertAttendanceAllocationCapacity } from '@/lib/guest-capacity-allocation'
import { runSerializableSeatingTransaction } from '@/lib/planner-seating-transaction'
import {
  resolveWeddingPassCredentialAdminState,
  type WeddingPassCredentialAdminState,
} from '@/lib/wedding-pass-availability'
import {
  lockServiceTeamRosterSlot,
  ServiceTeamRosterError,
} from '@/lib/service-team-authority'

const TEAM_STATUSES = ['draft', 'submitted', 'approved'] as const
export type ServiceTeamStatus = (typeof TEAM_STATUSES)[number]

function int(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

export async function createServiceTeam(input: {
  weddingId: string
  actorId: string
  serviceEngagementId: string
  name?: string
  allowedCrew?: number
  leaderEmail?: string | null
}) {
  const engagement = await db.serviceEngagement.findFirst({
    where: { id: input.serviceEngagementId, weddingId: input.weddingId },
    include: { vendor: { select: { id: true, name: true, category: true } } },
  })
  if (!engagement) throw new ServiceTeamRosterError('SERVICE_TEAM_NOT_FOUND', 'Service engagement not found.', 404)

  const allowedCrew = int(input.allowedCrew, 1)
  if (allowedCrew < 1 || allowedCrew > 500) {
    throw new ServiceTeamRosterError('SERVICE_TEAM_CREW_LIMIT_EXCEEDED', 'Allowed crew must be between 1 and 500.', 400)
  }

  const leaderEmail = input.leaderEmail?.trim().toLowerCase() || null
  const leaderUser = leaderEmail
    ? await db.user.findUnique({ where: { email: leaderEmail }, select: { id: true, isActive: true } })
    : null
  if (leaderEmail && (!leaderUser || !leaderUser.isActive)) {
    throw new ServiceTeamRosterError(
      'SERVICE_TEAM_LEADER_REQUIRED',
      'The team leader must have an active Wewed account using that email.',
      400,
    )
  }

  const name = cleanGuestText(input.name, 160) || `${engagement.vendor.name} · ${engagement.serviceCategory}`
  try {
    return await db.$transaction(async (tx) => {
      const team = await tx.serviceTeam.create({
        data: {
          weddingId: input.weddingId,
          serviceEngagementId: engagement.id,
          name,
          companyName: engagement.vendor.name,
          serviceCategory: engagement.serviceCategory || engagement.vendor.category,
          allowedCrew,
          leaderUserId: leaderUser?.id ?? null,
        },
      })
      await tx.auditEvent.create({
        data: {
          action: 'service_team.create',
          resourceType: 'service_team',
          resourceId: team.id,
          afterValue: JSON.stringify({
            serviceEngagementId: team.serviceEngagementId,
            companyName: team.companyName,
            serviceCategory: team.serviceCategory,
            allowedCrew: team.allowedCrew,
            leaderUserId: team.leaderUserId,
          }),
          weddingId: input.weddingId,
          actorId: input.actorId,
        },
      })
      return team
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ServiceTeamRosterError(
        'SERVICE_TEAM_ALREADY_EXISTS',
        'A service team with this name already exists for the selected engagement.',
        409,
      )
    }
    throw error
  }
}

export async function addServiceTeamMember(input: {
  weddingId: string
  actorId: string
  serviceTeamId: string
  name: string
  email?: string | null
  phone?: string | null
  function: string
  isLeader?: boolean
  submitted?: boolean
}) {
  const team = await db.serviceTeam.findFirst({
    where: { id: input.serviceTeamId, weddingId: input.weddingId },
    select: { id: true, leaderUserId: true },
  })
  if (!team) throw new ServiceTeamRosterError('SERVICE_TEAM_NOT_FOUND', 'Service team not found.', 404)

  // Backward compatibility for service-provider Guests that pre-date ServiceTeamMember. Planner
  // Guest creation historically allowed role=service_provider, so the roster migration must adopt
  // that canonical Guest rather than manufacture a second identity or leave the original Guest
  // permanently unable to receive approval/Pass authority. Email is the only safe automatic
  // identity key here; no fuzzy name/phone merge is attempted.
  const normalizedEmail = input.email?.trim().toLowerCase() || null
  const legacyProvider = normalizedEmail
    ? await db.guest.findFirst({
        where: {
          weddingId: input.weddingId,
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
        select: {
          id: true,
          role: true,
          attendanceAllocation: true,
          rsvp: { select: { id: true } },
          serviceTeamMemberships: { select: { id: true, serviceTeamId: true } },
        },
      })
    : null

  if (legacyProvider) {
    if (
      legacyProvider.role !== 'service_provider'
      && legacyProvider.serviceTeamMemberships.length === 0
    ) {
      throw new ServiceTeamRosterError(
        'SERVICE_TEAM_MEMBER_CONFLICT',
        'A Guest with this email already exists but is not registered as a service provider.',
        409,
      )
    }
    if (legacyProvider.serviceTeamMemberships.length > 0) {
      throw new ServiceTeamRosterError(
        'SERVICE_TEAM_MEMBER_CONFLICT',
        'This service provider is already registered on a service-team roster.',
        409,
      )
    }

    return runSerializableSeatingTransaction(async (tx) => {
      await lockServiceTeamRosterSlot(tx, {
        weddingId: input.weddingId,
        serviceTeamId: team.id,
      })
      const current = await tx.guest.findFirst({
        where: { id: legacyProvider.id, weddingId: input.weddingId },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
          serviceTeamMemberships: { select: { id: true } },
        },
      })
      if (!current) {
        throw new ServiceTeamRosterError(
          'SERVICE_TEAM_MEMBER_CONFLICT',
          'The existing service-provider Guest is no longer available.',
          409,
        )
      }
      if (current.serviceTeamMemberships.length > 0) {
        throw new ServiceTeamRosterError(
          'SERVICE_TEAM_MEMBER_CONFLICT',
          'This service provider is already registered on a service-team roster.',
          409,
        )
      }

      const capacity = await assertAttendanceAllocationCapacity(tx, {
        weddingId: input.weddingId,
        allocation: 'operational',
        excludeGuestId: current.id,
      })
      const serviceFunction = cleanGuestText(input.function, 160) || 'Service team'
      const guest = await tx.guest.update({
        where: { id: current.id },
        data: {
          role: 'service_provider',
          roleDetail: serviceFunction,
          attendanceAllocation: 'operational',
          ...(input.phone ? { phone: cleanGuestText(input.phone, 80) } : {}),
        },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
      })
      if (!current.rsvp) {
        await tx.rSVP.create({
          data: { guestId: guest.id, token: randomUUID() },
        })
      }
      await tx.serviceTeamMember.create({
        data: {
          serviceTeamId: team.id,
          weddingId: input.weddingId,
          guestId: guest.id,
          function: serviceFunction,
          isLeader: input.isLeader === true,
          submittedAt: input.submitted === true ? new Date() : null,
        },
      })
      await tx.auditEvent.create({
        data: {
          action: 'service_team.member_adopted',
          resourceType: 'service_team_member',
          resourceId: guest.id,
          beforeValue: JSON.stringify({
            guestId: current.id,
            role: current.role,
            attendanceAllocation: current.attendanceAllocation,
          }),
          afterValue: JSON.stringify({
            guestId: guest.id,
            serviceTeamId: team.id,
            role: guest.role,
            attendanceAllocation: guest.attendanceAllocation,
            function: serviceFunction,
          }),
          weddingId: input.weddingId,
          actorId: input.actorId,
        },
      })
      const canonical = await tx.guest.findUniqueOrThrow({
        where: { id: guest.id },
        include: {
          rsvp: true,
          seatingTable: { select: { id: true, name: true, capacity: true } },
        },
      })
      return { ok: true, status: 201, data: canonical, capacity } as const
    })
  }

  const result = await createPlannerGuest(
    { weddingId: input.weddingId, actorId: input.actorId },
    {
      name: input.name,
      email: input.email ?? undefined,
      phone: input.phone ?? undefined,
      role: 'service_provider',
      roleDetail: input.function,
      side: 'neutral',
      attendanceAllocation: 'operational',
      serviceTeamId: team.id,
      serviceFunction: input.function,
      serviceLeader: input.isLeader === true,
      serviceSubmitted: input.submitted === true,
    },
  )
  if (!result.ok) {
    throw new ServiceTeamRosterError(
      result.status === 409 ? 'SERVICE_TEAM_CREW_LIMIT_EXCEEDED' : 'SERVICE_TEAM_NOT_FOUND',
      result.error,
      result.status,
    )
  }
  return result
}

export async function submitServiceTeam(input: {
  weddingId: string
  serviceTeamId: string
  actorId: string
}) {
  return db.$transaction(async (tx) => {
    const team = await tx.serviceTeam.findFirst({
      where: { id: input.serviceTeamId, weddingId: input.weddingId },
      include: { members: true },
    })
    if (!team) throw new ServiceTeamRosterError('SERVICE_TEAM_NOT_FOUND', 'Service team not found.', 404)
    if (team.rosterStatus !== 'draft') {
      throw new ServiceTeamRosterError(
        'SERVICE_TEAM_ROSTER_APPROVED',
        'Only a draft service roster can be submitted. Reopen it before making another submission.',
        409,
      )
    }
    if (team.members.length === 0) {
      throw new ServiceTeamRosterError('SERVICE_TEAM_CREW_LIMIT_EXCEEDED', 'Add at least one named crew member before submitting.', 400)
    }
    if (team.members.length > team.allowedCrew) {
      throw new ServiceTeamRosterError('SERVICE_TEAM_CREW_LIMIT_EXCEEDED', 'Roster exceeds the allowed crew count.', 409)
    }
    const now = new Date()
    await tx.serviceTeamMember.updateMany({
      where: { serviceTeamId: team.id, submittedAt: null },
      data: { submittedAt: now },
    })
    const updated = await tx.serviceTeam.update({
      where: { id: team.id },
      data: { rosterStatus: 'submitted', submittedAt: now, approvedAt: null },
    })
    await tx.auditEvent.create({
      data: {
        action: 'service_team.submit',
        resourceType: 'service_team',
        resourceId: team.id,
        afterValue: JSON.stringify({ registered: team.members.length, allowedCrew: team.allowedCrew }),
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return updated
  })
}

export async function approveServiceTeam(input: {
  weddingId: string
  serviceTeamId: string
  actorId: string
}) {
  return db.$transaction(async (tx) => {
    const team = await tx.serviceTeam.findFirst({
      where: { id: input.serviceTeamId, weddingId: input.weddingId },
      include: { members: true },
    })
    if (!team) throw new ServiceTeamRosterError('SERVICE_TEAM_NOT_FOUND', 'Service team not found.', 404)
    if (team.rosterStatus !== 'submitted') {
      throw new ServiceTeamRosterError('SERVICE_TEAM_ROSTER_APPROVED', 'Submit the roster before approval.', 409)
    }
    const now = new Date()
    await tx.serviceTeamMember.updateMany({
      where: { serviceTeamId: team.id, submittedAt: { not: null } },
      data: { approvedAt: now },
    })
    const updated = await tx.serviceTeam.update({
      where: { id: team.id },
      data: { rosterStatus: 'approved', approvedAt: now },
    })
    await tx.auditEvent.create({
      data: {
        action: 'service_team.approve',
        resourceType: 'service_team',
        resourceId: team.id,
        afterValue: JSON.stringify({ registered: team.members.length, allowedCrew: team.allowedCrew }),
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return updated
  })
}

export async function reopenServiceTeam(input: {
  weddingId: string
  serviceTeamId: string
  actorId: string
}) {
  return db.$transaction(async (tx) => {
    const team = await tx.serviceTeam.findFirst({
      where: { id: input.serviceTeamId, weddingId: input.weddingId },
    })
    if (!team) throw new ServiceTeamRosterError('SERVICE_TEAM_NOT_FOUND', 'Service team not found.', 404)
    await tx.serviceTeamMember.updateMany({
      where: { serviceTeamId: team.id },
      data: { approvedAt: null },
    })
    const updated = await tx.serviceTeam.update({
      where: { id: team.id },
      data: { rosterStatus: 'draft', approvedAt: null },
    })
    await tx.auditEvent.create({
      data: {
        action: 'service_team.reopen',
        resourceType: 'service_team',
        resourceId: team.id,
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return updated
  })
}

function isPassReady(state: WeddingPassCredentialAdminState) {
  return state === 'not_yet_issued' || state === 'active'
}

export async function loadServiceTeamOperations(weddingId: string) {
  const [wedding, teams, engagements] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: { date: true, title: true },
    }),
    db.serviceTeam.findMany({
      where: { weddingId },
      include: {
        leaderUser: { select: { id: true, email: true, name: true } },
        serviceEngagement: {
          include: { vendor: { select: { id: true, name: true, category: true } } },
        },
        members: {
          include: {
            guest: {
              include: {
                rsvp: true,
                nativePresences: {
                  select: { platform: true, appVersion: true, lastSeenAt: true },
                  orderBy: { lastSeenAt: 'desc' },
                },
                passCredentials: {
                  select: {
                    issueSeq: true,
                    revokedAt: true,
                    revocationReason: true,
                    supersededAt: true,
                    expiresAt: true,
                  },
                  orderBy: { issueSeq: 'desc' },
                  take: 1,
                },
                seatingTable: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ companyName: 'asc' }, { name: 'asc' }],
    }),
    db.serviceEngagement.findMany({
      where: { weddingId },
      include: { vendor: { select: { id: true, name: true, category: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  if (!wedding) return null

  const data = teams.map((team) => {
    const members = team.members.map((member) => {
      const latest = member.guest.passCredentials[0] ?? null
      const passState = resolveWeddingPassCredentialAdminState({
        attending: member.guest.rsvp?.attending ?? null,
        weddingDate: wedding.date,
        latest,
        admissionApproved: Boolean(member.approvedAt),
      })
      const appActive = member.guest.nativePresences.length > 0
      const confirmed = member.guest.rsvp?.attending === true
      const arrived = member.guest.rsvp?.checkedIn === true
      return {
        id: member.id,
        guestId: member.guestId,
        name: member.guest.name,
        email: member.guest.email,
        phone: member.guest.phone,
        // Membership is the canonical professional classification even if legacy role text drifted.
        participantType: 'service_provider',
        company: team.companyName,
        serviceCategory: team.serviceCategory,
        function: member.function,
        isLeader: member.isLeader,
        submitted: Boolean(member.submittedAt),
        approved: Boolean(member.approvedAt),
        confirmed,
        appActive,
        nativePlatforms: member.guest.nativePresences.map((presence) => presence.platform),
        passState,
        passReady: isPassReady(passState),
        arrived,
        missing: confirmed && !arrived,
        seatingTable: member.guest.seatingTable?.name ?? null,
      }
    })

    return {
      id: team.id,
      name: team.name,
      company: team.companyName,
      serviceCategory: team.serviceCategory,
      allowedCrew: team.allowedCrew,
      rosterStatus: team.rosterStatus,
      serviceEngagementId: team.serviceEngagementId,
      vendorId: team.serviceEngagement.vendorId,
      leader: team.leaderUser,
      registered: members.length,
      submitted: members.filter((member) => member.submitted).length,
      approved: members.filter((member) => member.approved).length,
      confirmed: members.filter((member) => member.confirmed).length,
      appActive: members.filter((member) => member.appActive).length,
      passReady: members.filter((member) => member.passReady).length,
      arrived: members.filter((member) => member.arrived).length,
      missing: members.filter((member) => member.missing).length,
      members,
    }
  })

  return {
    wedding: { title: wedding.title, date: wedding.date.toISOString() },
    engagements: engagements.map((engagement) => ({
      id: engagement.id,
      serviceCategory: engagement.serviceCategory,
      vendorId: engagement.vendorId,
      vendorName: engagement.vendor.name,
      vendorCategory: engagement.vendor.category,
    })),
    teams: data,
  }
}
