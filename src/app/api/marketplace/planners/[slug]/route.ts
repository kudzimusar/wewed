import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MarketplaceAccessError, toPublicProfile } from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p.*
       FROM public."PlannerProfile" p
       JOIN public."BusinessAccount" ba ON ba.id = p."businessAccountId"
       WHERE p.slug = $1
         AND p.status = 'published'
         AND ba.type = 'planning_company'
         AND ba.status = 'active'
         AND ba."onboardingStatus" = 'complete'
       LIMIT 1`,
      slug,
    )
    if (!rows[0]) throw new MarketplaceAccessError('Planner profile not found.', 404)
    return NextResponse.json({ success: true, planner: toPublicProfile(rows[0]) })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
