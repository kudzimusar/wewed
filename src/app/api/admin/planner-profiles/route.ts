import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { marketplaceId, text } from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'
import { requireWewedAdmin } from '@/lib/wewed-admin'

const REVIEW_TRANSITIONS = new Set(['published', 'changes_requested', 'rejected', 'suspended'])

export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, 'admin.accounts.read')
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p.*, ba.name AS "businessName", ba.slug AS "businessSlug",
              ba."subscriptionPlan", ba."subscriptionStatus"
       FROM public."PlannerProfile" p
       JOIN public."BusinessAccount" ba ON ba.id = p."businessAccountId"
       ORDER BY CASE p.status WHEN 'submitted' THEN 0 WHEN 'changes_requested' THEN 1 ELSE 2 END,
                p."updatedAt" DESC`,
    )
    return NextResponse.json({ success: true, profiles: rows })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireWewedAdmin(request, 'admin.accounts.approve')
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const profileId = text(body?.profileId, 160)
    const status = typeof body?.status === 'string' ? body.status : ''
    if (!profileId || !REVIEW_TRANSITIONS.has(status)) {
      return NextResponse.json({ success: false, error: 'Profile and valid review status are required.' }, { status: 400 })
    }

    const rows = await db.$queryRawUnsafe<Array<{ businessAccountId: string }>>(
      `UPDATE wewed_admin."PlannerProfile"
       SET status = $2,
           "reviewNotes" = $3,
           "reviewedAt" = CURRENT_TIMESTAMP,
           "reviewedByUserId" = $4,
           "publishedAt" = CASE WHEN $2 = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1
         AND (
           status = 'submitted'
           OR ($2 = 'suspended' AND status IN ('published','changes_requested','rejected'))
           OR (status = 'suspended' AND $2 IN ('published','changes_requested'))
         )
       RETURNING "businessAccountId"`,
      profileId,
      status,
      text(body?.reviewNotes, 2000),
      admin.session.userId,
    )
    if (!rows[0]) {
      return NextResponse.json({ success: false, error: 'Profile is not eligible for this review transition.' }, { status: 409 })
    }

    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAuditLog"
        (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
       VALUES ($1, $2, $3, $4, 'planner_profile', $5, $6::jsonb)`,
      marketplaceId('audit'),
      admin.session.userId,
      rows[0].businessAccountId,
      `planner_profile.${status}`,
      profileId,
      JSON.stringify({ reviewNotes: text(body?.reviewNotes, 2000) }),
    )

    return NextResponse.json({ success: true, status })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
