import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { approveServiceTeam, reopenServiceTeam, submitServiceTeam } from '@/lib/service-team-operations'
import { ServiceTeamRosterError } from '@/lib/service-team-authority'

function response(body: Record<string, unknown>, status = 200) {
  const result = NextResponse.json(body, { status })
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return result
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  const { id } = await params
  try {
    const body = (await request.json().catch(() => null)) as {
      action?: unknown
      allowedCrew?: unknown
      leaderEmail?: unknown
    } | null
    if (!body) return response({ success: false, error: 'Invalid request.' }, 400)

    if (body.action === 'approve') {
      const data = await approveServiceTeam({ weddingId: access.context.weddingId, serviceTeamId: id, actorId: access.context.session.userId })
      return response({ success: true, data })
    }
    if (body.action === 'reopen') {
      const data = await reopenServiceTeam({ weddingId: access.context.weddingId, serviceTeamId: id, actorId: access.context.session.userId })
      return response({ success: true, data })
    }
    if (body.action === 'submit') {
      const data = await submitServiceTeam({ weddingId: access.context.weddingId, serviceTeamId: id, actorId: access.context.session.userId })
      return response({ success: true, data })
    }

    const team = await db.serviceTeam.findFirst({ where: { id, weddingId: access.context.weddingId }, include: { members: true } })
    if (!team) return response({ success: false, error: 'Service team not found.' }, 404)

    const updates: { allowedCrew?: number; leaderUserId?: string | null } = {}
    if (body.allowedCrew !== undefined) {
      if (typeof body.allowedCrew !== 'number' || !Number.isInteger(body.allowedCrew) || body.allowedCrew < 1 || body.allowedCrew > 500) {
        return response({ success: false, error: 'Allowed crew must be between 1 and 500.' }, 400)
      }
      if (body.allowedCrew < team.members.length) {
        return response({
          success: false,
          code: 'SERVICE_TEAM_LIMIT_BELOW_REGISTERED',
          error: `This team already has ${team.members.length} registered crew, so the limit cannot be reduced to ${body.allowedCrew}.`,
        }, 409)
      }
      updates.allowedCrew = body.allowedCrew
    }
    if (body.leaderEmail !== undefined) {
      const email = typeof body.leaderEmail === 'string' ? body.leaderEmail.trim().toLowerCase() : ''
      if (!email) updates.leaderUserId = null
      else {
        const user = await db.user.findUnique({ where: { email }, select: { id: true, isActive: true } })
        if (!user?.isActive) return response({ success: false, error: 'The leader must have an active Wewed account.' }, 400)
        updates.leaderUserId = user.id
      }
    }
    if (!Object.keys(updates).length) return response({ success: false, error: 'No updates provided.' }, 400)
    const data = await db.serviceTeam.update({ where: { id }, data: updates })
    return response({ success: true, data })
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) {
      return response({ success: false, code: error.code, error: error.message }, error.status)
    }
    console.error('[planner service team PATCH] failed', error)
    return response({ success: false, error: 'Unable to update service team.' }, 500)
  }
}
