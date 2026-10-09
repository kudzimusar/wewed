import 'server-only'

import type { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession } from '@/lib/app-session'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'

export class ServiceTeamRosterError extends Error {
  constructor(
    readonly code:
      | 'SERVICE_TEAM_NOT_FOUND'
      | 'SERVICE_TEAM_CREW_LIMIT_EXCEEDED'
      | 'SERVICE_TEAM_ROSTER_APPROVED'
      | 'SERVICE_TEAM_LEADER_REQUIRED'
      | 'SERVICE_TEAM_ACCESS_DENIED'
      | 'SERVICE_TEAM_MEMBER_CONFLICT',
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ServiceTeamRosterError'
  }
}

export async function lockServiceTeamRosterSlot(
  tx: Prisma.TransactionClient,
  input: { weddingId: string; serviceTeamId: string },
) {
  const rows = await tx.$queryRawUnsafe<Array<{
    id: string
    allowedCrew: number
    rosterStatus: string
    serviceEngagementId: string
  }>>(
    `SELECT id, "allowedCrew", "rosterStatus", "serviceEngagementId"
       FROM public."ServiceTeam"
      WHERE id = $1 AND "weddingId" = $2
      LIMIT 1
      FOR UPDATE`,
    input.serviceTeamId,
    input.weddingId,
  )
  const team = rows[0]
  if (!team) {
    throw new ServiceTeamRosterError('SERVICE_TEAM_NOT_FOUND', 'Service team not found.', 404)
  }
  if (team.rosterStatus === 'approved') {
    throw new ServiceTeamRosterError(
      'SERVICE_TEAM_ROSTER_APPROVED',
      'This service roster is already approved. Reopen it before changing the crew.',
      409,
    )
  }
  const registered = await tx.serviceTeamMember.count({
    where: { weddingId: input.weddingId, serviceTeamId: input.serviceTeamId },
  })
  if (registered >= team.allowedCrew) {
    throw new ServiceTeamRosterError(
      'SERVICE_TEAM_CREW_LIMIT_EXCEEDED',
      `This service team already has ${registered} of ${team.allowedCrew} allowed crew registered.`,
      409,
    )
  }
  return { ...team, registered }
}

export async function requireServiceTeamLeader(request: NextRequest, serviceTeamId: string) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') {
    throw new ServiceTeamRosterError(
      'SERVICE_TEAM_ACCESS_DENIED',
      'Vendor sign-in is required.',
      401,
    )
  }

  const team = await db.serviceTeam.findUnique({
    where: { id: serviceTeamId },
    include: {
      serviceEngagement: {
        select: { id: true, vendorId: true, weddingId: true },
      },
    },
  })
  if (!team || team.leaderUserId !== session.userId) {
    throw new ServiceTeamRosterError(
      'SERVICE_TEAM_LEADER_REQUIRED',
      'Only the designated service-team leader can manage this roster.',
      403,
    )
  }

  // The explicit leader binding is necessary but not sufficient. Re-resolve the caller's current
  // production authority and require a Vendor wedding grant that contains this exact engagement.
  const authority = await resolveProductionAuthority(session.userId, { authUserId: session.authUserId })
  const vendorGrant = authority.workspaceGrants.find((grant) =>
    grant.workspaceKind === 'vendor'
    && grant.scopeKind === 'wedding'
    && grant.weddingId === team.weddingId
    && grant.vendorId === team.serviceEngagement.vendorId
    && grant.serviceEngagementIds.includes(team.serviceEngagementId)
  )
  if (!vendorGrant) {
    throw new ServiceTeamRosterError(
      'SERVICE_TEAM_ACCESS_DENIED',
      'This service team is not part of your current Vendor authority.',
      403,
    )
  }

  return { session, team, vendorGrant }
}
