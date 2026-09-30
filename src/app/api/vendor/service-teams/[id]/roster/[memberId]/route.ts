import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deletePlannerGuest, updatePlannerGuest } from '@/lib/planner-guest-operations'
import { requireServiceTeamLeader, ServiceTeamRosterError } from '@/lib/service-team-authority'

function response(body: Record<string, unknown>, status = 200) {
  const result = NextResponse.json(body, { status })
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  result.headers.set('Vary', 'Cookie')
  return result
}

async function memberForTeam(serviceTeamId: string, memberId: string, weddingId: string) {
  return db.serviceTeamMember.findFirst({
    where: { id: memberId, serviceTeamId, weddingId },
    include: { guest: { select: { id: true } } },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params
  try {
    const access = await requireServiceTeamLeader(request, id)
    if (access.team.rosterStatus === 'approved') {
      throw new ServiceTeamRosterError('SERVICE_TEAM_ROSTER_APPROVED', 'Approved rosters must be reopened by the Planner before editing.', 409)
    }
    const member = await memberForTeam(id, memberId, access.team.weddingId)
    if (!member) return response({ success: false, error: 'Crew member not found.' }, 404)

    const body = (await request.json().catch(() => null)) as {
      name?: unknown
      email?: unknown
      phone?: unknown
      function?: unknown
    } | null
    if (!body) return response({ success: false, error: 'Invalid request.' }, 400)

    const guestResult = await updatePlannerGuest(
      { weddingId: access.team.weddingId, actorId: access.session.userId },
      member.guestId,
      {
        ...(typeof body.name === 'string' ? { name: body.name } : {}),
        ...('email' in body ? { email: typeof body.email === 'string' ? body.email : null } : {}),
        ...('phone' in body ? { phone: typeof body.phone === 'string' ? body.phone : null } : {}),
        role: 'service_provider',
        attendanceAllocation: 'operational',
      },
    )
    if (!guestResult.ok) {
      return response({ success: false, error: guestResult.error, ...('field' in guestResult && guestResult.field ? { field: guestResult.field } : {}) }, guestResult.status)
    }

    if (typeof body.function === 'string' && body.function.trim()) {
      await db.serviceTeamMember.update({
        where: { id: member.id },
        data: { function: body.function.trim().slice(0, 160) },
      })
    }
    return response({ success: true })
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) return response({ success: false, code: error.code, error: error.message }, error.status)
    return response({ success: false, error: 'Unable to update crew member.' }, 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params
  try {
    const access = await requireServiceTeamLeader(request, id)
    if (access.team.rosterStatus === 'approved') {
      throw new ServiceTeamRosterError('SERVICE_TEAM_ROSTER_APPROVED', 'Approved rosters must be reopened by the Planner before editing.', 409)
    }
    const member = await memberForTeam(id, memberId, access.team.weddingId)
    if (!member) return response({ success: false, error: 'Crew member not found.' }, 404)

    const result = await deletePlannerGuest(
      { weddingId: access.team.weddingId, actorId: access.session.userId },
      member.guestId,
    )
    if (!result.ok) {
      return response({
        success: false,
        error: result.error,
        ...('code' in result ? { code: result.code } : {}),
      }, result.status)
    }
    return response({ success: true, data: result.data })
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) return response({ success: false, code: error.code, error: error.message }, error.status)
    return response({ success: false, error: 'Unable to remove crew member.' }, 500)
  }
}
