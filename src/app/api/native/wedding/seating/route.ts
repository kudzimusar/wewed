import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §9 — Seating (read-only in this phase). Real `SeatingTable` + assigned
 * `Guest` rows, scoped to the freshly-resolved grant's wedding only — never a table from another
 * wedding (§9: "Never allow a Guest/table from another wedding").
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'seating.view')
  if (!permission.ok) return permission.response

  const tables = await db.seatingTable.findMany({
    where: { weddingId: scope.weddingId },
    include: { guests: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: 'asc' }],
  })

  return noStoreJson({
    success: true,
    count: tables.length,
    data: tables.map((table) => ({
      id: table.id,
      name: table.name,
      capacity: table.capacity,
      assigned: table.guests.length,
      guests: table.guests,
    })),
  })
}
