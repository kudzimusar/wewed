import { NextRequest, NextResponse } from 'next/server'
import { requireServiceTeamLeader, ServiceTeamRosterError } from '@/lib/service-team-authority'
import { addServiceTeamMember, loadServiceTeamOperations, submitServiceTeam } from '@/lib/service-team-operations'

function response(body: Record<string, unknown>, status = 200) {
  const result = NextResponse.json(body, { status })
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  result.headers.set('Vary', 'Cookie')
  return result
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const access = await requireServiceTeamLeader(request, id)
    const projection = await loadServiceTeamOperations(access.team.weddingId)
    const team = projection?.teams.find((item) => item.id === id) ?? null
    if (!team) return response({ success: false, error: 'Service team not found.' }, 404)
    return response({ success: true, data: team })
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) return response({ success: false, code: error.code, error: error.message }, error.status)
    return response({ success: false, error: 'Unable to load service roster.' }, 500)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const access = await requireServiceTeamLeader(request, id)
    if (access.team.rosterStatus !== 'draft') {
      throw new ServiceTeamRosterError(
        'SERVICE_TEAM_ROSTER_APPROVED',
        'A submitted roster is locked for Planner review. The Planner must reopen it before the leader can change crew.',
        409,
      )
    }
    const body = (await request.json().catch(() => null)) as {
      name?: unknown
      email?: unknown
      phone?: unknown
      function?: unknown
    } | null
    if (!body || typeof body.name !== 'string' || typeof body.function !== 'string') {
      return response({ success: false, error: 'Name and service function are required.' }, 400)
    }
    const result = await addServiceTeamMember({
      weddingId: access.team.weddingId,
      actorId: access.session.userId,
      serviceTeamId: id,
      name: body.name,
      email: typeof body.email === 'string' ? body.email : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      function: body.function,
      submitted: false,
    })
    return response({ success: true, data: result.data }, 201)
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) return response({ success: false, code: error.code, error: error.message }, error.status)
    return response({ success: false, error: 'Unable to add crew member.' }, 500)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const access = await requireServiceTeamLeader(request, id)
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null
    if (body?.action !== 'submit') {
      return response({ success: false, error: 'Vendor leaders may only submit their own roster from this endpoint.' }, 400)
    }
    const data = await submitServiceTeam({
      weddingId: access.team.weddingId,
      serviceTeamId: id,
      actorId: access.session.userId,
    })
    return response({ success: true, data })
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) return response({ success: false, code: error.code, error: error.message }, error.status)
    return response({ success: false, error: 'Unable to submit service roster.' }, 500)
  }
}
