import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface PlannerDirectoryRow {
  userId: string
  email: string
  name: string | null
  businessAccountId: string
  businessName: string
  profileStatus: string | null
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'members.manage')
  if (access.error) return access.error

  const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? ''
  if (search.length < 2) {
    return NextResponse.json({ success: true, planners: [] })
  }

  try {
    const planners = await db.$queryRawUnsafe<PlannerDirectoryRow[]>(
      `
        SELECT DISTINCT ON (u.id)
               u.id AS "userId",
               u.email,
               COALESCE(NULLIF(u.name, ''), NULLIF(p."displayName", ''), ba.name) AS name,
               ba.id AS "businessAccountId",
               ba.name AS "businessName",
               p.status AS "profileStatus"
        FROM public."BusinessAccountMember" bam
        JOIN public."BusinessAccount" ba
          ON ba.id = bam."businessAccountId"
        JOIN public."User" u
          ON u.id = bam."userId"
        LEFT JOIN public."PlannerProfile" p
          ON p."businessAccountId" = ba.id
        WHERE bam.status = 'active'
          AND bam.role = 'business_owner'
          AND ba.type = 'planning_company'
          AND ba.status = 'active'
          AND ba."onboardingStatus" = 'complete'
          AND COALESCE(ba.metadata->>'testData', 'false') <> 'true'
          AND u."isActive" = TRUE
          AND u.role = 'planner'
          AND (
            lower(ba.name) LIKE '%' || $1 || '%'
            OR lower(COALESCE(u.name, '')) LIKE '%' || $1 || '%'
            OR lower(u.email) LIKE '%' || $1 || '%'
            OR lower(COALESCE(p."displayName", '')) LIKE '%' || $1 || '%'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public."WeddingMembership" existing
            WHERE existing."weddingId" = $2
              AND existing."userId" = u.id
              AND existing.status IN ('active', 'invited')
          )
        ORDER BY u.id, ba.name ASC
        LIMIT 10
      `,
      search,
      access.context.weddingId,
    )

    return NextResponse.json({
      success: true,
      planners: planners.map((planner) => ({
        ...planner,
        profileStatus: planner.profileStatus ?? 'private',
      })),
    })
  } catch (error) {
    console.error('[weddings/planner-directory GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to search registered planners.' },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic'
