import 'server-only'

import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

const SCHEDULER_CREDENTIAL_ID = 'automatic_dispatch'

export async function communicationSchedulerAuthorized(authorization: string | null): Promise<boolean> {
  if (!authorization?.startsWith('Bearer ')) return false
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) return false

  const secretHash = createHash('sha256').update(token).digest('hex')
  const rows = await db.$queryRaw<Array<{ authorized: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM wewed_communications."CommunicationSchedulerCredential"
      WHERE "id" = ${SCHEDULER_CREDENTIAL_ID}
        AND "secretHash" = ${secretHash}
    ) AS "authorized"
  `)
  return rows[0]?.authorized === true
}
