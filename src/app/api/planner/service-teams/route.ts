import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { createServiceTeam, loadServiceTeamOperations } from '@/lib/service-team-operations'
import { ServiceTeamRosterError } from '@/lib/service-team-authority'

function response(body: Record<string, unknown>, status = 200) {
  const result = NextResponse.json(body, { status })
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  result.headers.set('Vary', 'Cookie')
  return result
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  const data = await loadServiceTeamOperations(access.context.weddingId)
  return response({ success: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const body = (await request.json().catch(() => null)) as {
      serviceEngagementId?: unknown
      name?: unknown
      allowedCrew?: unknown
      leaderEmail?: unknown
    } | null
    if (!body || typeof body.serviceEngagementId !== 'string') {
      return response({ success: false, error: 'Choose a service engagement.' }, 400)
    }
    const team = await createServiceTeam({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      serviceEngagementId: body.serviceEngagementId,
      name: typeof body.name === 'string' ? body.name : undefined,
      allowedCrew: typeof body.allowedCrew === 'number' ? body.allowedCrew : undefined,
      leaderEmail: typeof body.leaderEmail === 'string' ? body.leaderEmail : null,
    })
    return response({ success: true, data: team }, 201)
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) {
      return response({ success: false, code: error.code, error: error.message }, error.status)
    }
    console.error('[planner service teams POST] failed', error)
    return response({ success: false, error: 'Unable to create service team.' }, 500)
  }
}
