import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringList, toPublicProfile } from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? ''
    const area = request.nextUrl.searchParams.get('area')?.trim().toLowerCase() ?? ''
    const service = request.nextUrl.searchParams.get('service')?.trim().toLowerCase() ?? ''
    const style = request.nextUrl.searchParams.get('style')?.trim().toLowerCase() ?? ''
    const priceBand = request.nextUrl.searchParams.get('priceBand')?.trim() ?? ''
    const availability = request.nextUrl.searchParams.get('availability')?.trim() ?? ''

    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p.*
       FROM public."PlannerProfile" p
       JOIN public."BusinessAccount" ba ON ba.id = p."businessAccountId"
       WHERE p.status = 'published'
         AND ba.type = 'planning_company'
         AND ba.status = 'active'
         AND ba."onboardingStatus" = 'complete'
         AND COALESCE(ba.metadata->>'testData', 'false') <> 'true'
         AND ($1 = '' OR lower(p."displayName") LIKE '%' || $1 || '%' OR lower(COALESCE(p.headline, '')) LIKE '%' || $1 || '%')
         AND ($2 = '' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p."serviceAreas") area_value WHERE lower(area_value) LIKE '%' || $2 || '%'))
         AND ($3 = '' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.services) service_value WHERE lower(service_value) = $3))
         AND ($4 = '' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p."weddingStyles") style_value WHERE lower(style_value) = $4))
         AND ($5 = '' OR p."priceBand" = $5)
         AND ($6 = '' OR p."availabilityStatus" = $6)
       ORDER BY CASE p."availabilityStatus" WHEN 'accepting' THEN 0 WHEN 'limited' THEN 1 ELSE 2 END,
                p."publishedAt" DESC NULLS LAST,
                p."displayName" ASC
       LIMIT 100`,
      search,
      area,
      service,
      style,
      priceBand,
      availability,
    )

    const facets = {
      serviceAreas: Array.from(new Set(rows.flatMap((row) => stringList(row.serviceAreas)))).sort(),
      services: Array.from(new Set(rows.flatMap((row) => stringList(row.services)))).sort(),
      weddingStyles: Array.from(new Set(rows.flatMap((row) => stringList(row.weddingStyles)))).sort(),
    }

    return NextResponse.json({
      success: true,
      planners: rows.map(toPublicProfile),
      facets,
    })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
