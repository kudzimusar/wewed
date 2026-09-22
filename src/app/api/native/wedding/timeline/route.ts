import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §9 — Timeline (read-only in this phase). Real `ProgrammeItem` rows — the
 * same model the PWA `/api/planner/timeline` route reads (§9: "Reuse existing timeline/programme
 * source. Do not invent a native timeline store.").
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'timeline.view')
  if (!permission.ok) return permission.response

  const items = await db.programmeItem.findMany({
    where: { weddingId: scope.weddingId },
    orderBy: [{ order: 'asc' }, { time: 'asc' }],
  })

  return noStoreJson({
    success: true,
    count: items.length,
    data: items.map((item) => ({
      id: item.id,
      time: item.time,
      title: item.title,
      description: item.description,
      location: item.location,
      order: item.order,
    })),
  })
}
