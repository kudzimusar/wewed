import 'server-only'

import { db } from '@/lib/db'

interface PlanningBusinessRow {
  businessAccountId: string
}

export async function syncPlannerMembershipBusinessLink(input: {
  membershipId: string
  userId: string
  weddingId: string
  role: string
  status: string
}): Promise<void> {
  const linkId = `planner-wedding-${input.membershipId}`
  const shouldManage = ['planner', 'coordinator'].includes(input.role) && input.status !== 'revoked'

  if (!shouldManage) {
    await db.$executeRawUnsafe(
      `DELETE FROM public."BusinessAccountLink" WHERE id = $1`,
      linkId,
    )
    return
  }

  const businesses = await db.$queryRawUnsafe<PlanningBusinessRow[]>(
    `
      SELECT ba.id AS "businessAccountId"
      FROM public."BusinessAccountMember" bam
      JOIN public."BusinessAccount" ba
        ON ba.id = bam."businessAccountId"
      WHERE bam."userId" = $1
        AND bam.status = 'active'
        AND bam.role = 'business_owner'
        AND ba.type = 'planning_company'
        AND ba.status = 'active'
        AND ba."onboardingStatus" = 'complete'
        AND COALESCE(ba.metadata->>'testData', 'false') <> 'true'
      ORDER BY CASE WHEN ba."ownerUserId" = $1 THEN 0 ELSE 1 END,
               ba."createdAt" ASC,
               ba.id ASC
      LIMIT 1
    `,
    input.userId,
  )

  const business = businesses[0]
  if (!business) {
    await db.$executeRawUnsafe(
      `DELETE FROM public."BusinessAccountLink" WHERE id = $1`,
      linkId,
    )
    return
  }

  await db.$executeRawUnsafe(
    `
      INSERT INTO public."BusinessAccountLink" (
        id, "businessAccountId", "entityType", "entityId", relationship, "createdAt"
      )
      SELECT $1, $2, 'wedding', $3, 'manages', CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1
        FROM public."BusinessAccountLink" existing
        WHERE existing."businessAccountId" = $2
          AND existing."entityType" = 'wedding'
          AND existing."entityId" = $3
          AND existing.relationship = 'manages'
      )
    `,
    linkId,
    business.businessAccountId,
    input.weddingId,
  )
}
