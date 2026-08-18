import 'server-only'

import { db } from '@/lib/db'
import {
  buildBusinessAccountScopeSql,
  type WewedAdminContext,
} from '@/lib/wewed-admin'

export type AdminHistoricalWedding = {
  id: string
  slug: string
  title: string
  date: Date
  venue: string
  venueCity: string
  venueCountry: string
}

export class AdminHistoricalEngagementAccessError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 404,
  ) {
    super(message)
    this.name = 'AdminHistoricalEngagementAccessError'
  }
}

export async function listAdminHistoricalWeddings(
  context: WewedAdminContext,
): Promise<AdminHistoricalWedding[]> {
  if (context.accountScope.global) {
    return db.wedding.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        venue: true,
        venueCity: true,
        venueCountry: true,
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    })
  }

  const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
  return db.$queryRawUnsafe<AdminHistoricalWedding[]>(
    `SELECT DISTINCT
       w.id,
       w.slug,
       w.title,
       w.date,
       w.venue,
       w."venueCity",
       w."venueCountry"
     FROM public."Wedding" w
     JOIN wewed_admin."BusinessAccountLink" bal
       ON bal."entityType"='wedding'
      AND bal."entityId"=w.id
     JOIN wewed_admin."BusinessAccount" ba
       ON ba.id=bal."businessAccountId"
     WHERE ${scope.clause}
     ORDER BY w.date ASC, w.title ASC`,
    ...scope.values,
  )
}

export async function assertAdminHistoricalWeddingScope(
  context: WewedAdminContext,
  weddingId: string,
): Promise<AdminHistoricalWedding> {
  if (!weddingId.trim()) {
    throw new AdminHistoricalEngagementAccessError('A wedding is required.', 400)
  }

  if (context.accountScope.global) {
    const wedding = await db.wedding.findUnique({
      where: { id: weddingId },
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        venue: true,
        venueCity: true,
        venueCountry: true,
      },
    })
    if (!wedding) {
      throw new AdminHistoricalEngagementAccessError('Wedding not found.')
    }
    return wedding
  }

  const scope = buildBusinessAccountScopeSql(context, 'ba', 2)
  const rows = await db.$queryRawUnsafe<AdminHistoricalWedding[]>(
    `SELECT DISTINCT
       w.id,
       w.slug,
       w.title,
       w.date,
       w.venue,
       w."venueCity",
       w."venueCountry"
     FROM public."Wedding" w
     JOIN wewed_admin."BusinessAccountLink" bal
       ON bal."entityType"='wedding'
      AND bal."entityId"=w.id
     JOIN wewed_admin."BusinessAccount" ba
       ON ba.id=bal."businessAccountId"
     WHERE w.id=$1
       AND ${scope.clause}
     LIMIT 1`,
    weddingId,
    ...scope.values,
  )
  if (!rows[0]) {
    throw new AdminHistoricalEngagementAccessError(
      'The wedding is outside this administrator scope.',
    )
  }
  return rows[0]
}
