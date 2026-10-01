import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { addServiceTeamMember } from '@/lib/service-team-operations'
import { ServiceTeamRosterError } from '@/lib/service-team-authority'

function response(body: Record<string, unknown>, status = 200) {
  const result = NextResponse.json(body, { status })
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return result
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  const { id } = await params
  try {
    const body = (await request.json().catch(() => null)) as {
      name?: unknown
      email?: unknown
      phone?: unknown
      function?: unknown
      isLeader?: unknown
    } | null
    if (!body || typeof body.name !== 'string' || typeof body.function !== 'string') {
      return response({ success: false, error: 'Name and service function are required.' }, 400)
    }
    const result = await addServiceTeamMember({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      serviceTeamId: id,
      name: body.name,
      email: typeof body.email === 'string' ? body.email : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      function: body.function,
      isLeader: body.isLeader === true,
    })
    return response({ success: true, data: result.data, capacity: result.capacity ?? null }, 201)
  } catch (error) {
    if (error instanceof ServiceTeamRosterError) {
      return response({ success: false, code: error.code, error: error.message }, error.status)
    }
    console.error('[planner service team member POST] failed', error)
    return response({ success: false, error: 'Unable to add service-team member.' }, 500)
  }
}
