import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession } from '@/lib/app-session'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'
import { loadServiceTeamOperations } from '@/lib/service-team-operations'

function response(body: Record<string, unknown>, status = 200) {
  const result = NextResponse.json(body, { status })
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  result.headers.set('Vary', 'Cookie')
  return result
}

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') {
    return response({ success: false, error: 'Vendor sign-in is required.' }, 401)
  }

  const authority = await resolveProductionAuthority(session.userId, { authUserId: session.authUserId })
  const grants = authority.workspaceGrants.filter((grant) =>
    grant.workspaceKind === 'vendor' && grant.scopeKind === 'wedding' && grant.weddingId
  )
  if (!grants.length) return response({ success: true, data: [] })

  const teams = await db.serviceTeam.findMany({
    where: { leaderUserId: session.userId, weddingId: { in: grants.map((grant) => grant.weddingId!) } },
    select: { id: true, weddingId: true, serviceEngagementId: true },
    orderBy: { createdAt: 'asc' },
  })

  const grouped = new Map<string, Awaited<ReturnType<typeof loadServiceTeamOperations>>>()
  const result: unknown[] = []
  for (const team of teams) {
    const grant = grants.find((item) =>
      item.weddingId === team.weddingId && item.serviceEngagementIds.includes(team.serviceEngagementId)
    )
    if (!grant) continue
    let projection = grouped.get(team.weddingId)
    if (projection === undefined) {
      projection = await loadServiceTeamOperations(team.weddingId)
      grouped.set(team.weddingId, projection)
    }
    const row = projection?.teams.find((item) => item.id === team.id)
    if (row) result.push(row)
  }

  return response({ success: true, data: result })
}
