import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { marketplaceId, text } from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'
import { readWeddingIntelligence } from '@/lib/planner-relationship-intelligence'
import { requireWewedAdmin } from '@/lib/wewed-admin'

const REVIEW_TRANSITIONS = new Set(['published', 'changes_requested', 'rejected', 'suspended'])

type PlanningRelationshipRow = {
  businessAccountId: string
  plannerUserId: string
  plannerEmail: string
  plannerName: string | null
  membershipId: string
  weddingId: string
  role: string
  status: string
  acceptedAt: Date | null
  revokedAt: Date | null
}

type WeddingIndexRow = {
  weddingId: string
  slug: string
  title: string
  date: Date
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  partner1: string
  partner2: string
}

type WeddingPlanningMemberRow = {
  membershipId: string
  weddingId: string
  plannerUserId: string
  plannerEmail: string
  plannerName: string | null
  role: string
  status: string
  acceptedAt: Date | null
  revokedAt: Date | null
  businessAccountId: string | null
  businessName: string | null
}

function serializeIntelligence(wedding: Awaited<ReturnType<typeof readWeddingIntelligence>>[number]) {
  return {
    ...wedding,
    date: wedding.date.toISOString(),
  }
}

function relationshipState(rows: PlanningRelationshipRow[]) {
  if (rows.some((row) => row.status === 'active')) return 'active'
  if (rows.some((row) => row.status === 'invited')) return 'invited'
  return 'revoked'
}

export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, 'admin.accounts.read')
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         p.*,
         ba.id AS "businessAccountId",
         ba.name AS "businessName",
         ba.slug AS "businessSlug",
         ba.status AS "businessStatus",
         ba."onboardingStatus",
         ba."subscriptionPlan",
         ba."subscriptionStatus",
         ba."ownerUserId",
         u.email AS "ownerEmail",
         u.name AS "ownerName",
         CASE WHEN p.id IS NULL THEN 'not_started' ELSE p.status END AS "profileState"
       FROM public."BusinessAccount" ba
       LEFT JOIN public."PlannerProfile" p ON p."businessAccountId" = ba.id
       LEFT JOIN public."User" u ON u.id = ba."ownerUserId"
       WHERE ba.type = 'planning_company'
       ORDER BY
         CASE
           WHEN p.id IS NULL THEN 0
           WHEN p.status = 'submitted' THEN 1
           WHEN p.status = 'changes_requested' THEN 2
           WHEN p.status = 'draft' THEN 3
           WHEN p.status = 'published' THEN 4
           ELSE 5
         END,
         COALESCE(p."updatedAt", ba."updatedAt") DESC`,
    )

    const businessAccountIds = rows
      .map((row) => (typeof row.businessAccountId === 'string' ? row.businessAccountId : ''))
      .filter(Boolean)

    const [planningRelationships, weddingIndex, weddingPlanningMembers] = await Promise.all([
      businessAccountIds.length
        ? db.$queryRawUnsafe<PlanningRelationshipRow[]>(
            `SELECT
               bam."businessAccountId",
               bam."userId" AS "plannerUserId",
               planner.email AS "plannerEmail",
               planner.name AS "plannerName",
               membership.id AS "membershipId",
               membership."weddingId",
               membership.role,
               membership.status,
               membership."acceptedAt",
               membership."revokedAt"
             FROM public."BusinessAccountMember" bam
             JOIN public."User" planner ON planner.id=bam."userId"
             JOIN public."WeddingMembership" membership ON membership."userId"=bam."userId"
             WHERE bam."businessAccountId" = ANY($1::text[])
               AND bam.status='active'
               AND membership.role IN ('planner','coordinator')
               AND membership.status IN ('active','invited','revoked')
             ORDER BY bam."businessAccountId", membership."weddingId",
               CASE membership.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
               planner.name NULLS LAST, planner.email`,
            businessAccountIds,
          )
        : Promise.resolve([]),
      db.$queryRawUnsafe<WeddingIndexRow[]>(
        `SELECT
           wedding.id AS "weddingId",
           wedding.slug,
           wedding.title,
           wedding.date,
           wedding.venue,
           wedding."venueCity",
           wedding."venueCountry",
           wedding."coupleId",
           couple.partner1,
           couple.partner2
         FROM public."Wedding" wedding
         JOIN public."Couple" couple ON couple.id=wedding."coupleId"
         ORDER BY wedding.date ASC, wedding."createdAt" ASC`,
      ),
      db.$queryRawUnsafe<WeddingPlanningMemberRow[]>(
        `SELECT
           membership.id AS "membershipId",
           membership."weddingId",
           membership."userId" AS "plannerUserId",
           planner.email AS "plannerEmail",
           planner.name AS "plannerName",
           membership.role,
           membership.status,
           membership."acceptedAt",
           membership."revokedAt",
           planner_business.id AS "businessAccountId",
           planner_business.name AS "businessName"
         FROM public."WeddingMembership" membership
         JOIN public."User" planner ON planner.id=membership."userId"
         LEFT JOIN LATERAL (
           SELECT business.id, business.name
           FROM public."BusinessAccountMember" business_member
           JOIN public."BusinessAccount" business
             ON business.id=business_member."businessAccountId"
           WHERE business_member."userId"=membership."userId"
             AND business_member.status='active'
             AND business.type='planning_company'
           ORDER BY business."createdAt" ASC
           LIMIT 1
         ) planner_business ON true
         WHERE membership.role IN ('planner','coordinator')
           AND membership.status IN ('active','invited','revoked')
         ORDER BY membership."weddingId",
           CASE membership.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
           planner.name NULLS LAST, planner.email`,
      ),
    ])

    const intelligence = await readWeddingIntelligence(weddingIndex.map((wedding) => wedding.weddingId))
    const intelligenceByWedding = new Map(
      intelligence.map((wedding) => [wedding.weddingId, serializeIntelligence(wedding)]),
    )

    const profiles = rows.map((row) => {
      const businessAccountId = String(row.businessAccountId ?? '')
      const businessRelationships = planningRelationships.filter(
        (relationship) => relationship.businessAccountId === businessAccountId,
      )
      const weddingIds = Array.from(new Set(businessRelationships.map((relationship) => relationship.weddingId)))
      const managedWeddings = weddingIds.map((weddingId) => {
        const relationshipRows = businessRelationships.filter(
          (relationship) => relationship.weddingId === weddingId,
        )
        const wedding = intelligenceByWedding.get(weddingId)
        return {
          ...(wedding || { weddingId }),
          relationshipStatus: relationshipState(relationshipRows),
          professionals: relationshipRows.map((relationship) => ({
            membershipId: relationship.membershipId,
            userId: relationship.plannerUserId,
            name: relationship.plannerName,
            email: relationship.plannerEmail,
            role: relationship.role,
            status: relationship.status,
            acceptedAt: relationship.acceptedAt?.toISOString() || null,
            revokedAt: relationship.revokedAt?.toISOString() || null,
          })),
        }
      })

      return {
        ...row,
        relationshipSummary: {
          activeWeddings: managedWeddings.filter((wedding) => wedding.relationshipStatus === 'active').length,
          invitedWeddings: managedWeddings.filter((wedding) => wedding.relationshipStatus === 'invited').length,
          historicalWeddings: managedWeddings.filter((wedding) => wedding.relationshipStatus === 'revoked').length,
          upcomingWeddings: managedWeddings.filter(
            (wedding) =>
              wedding.relationshipStatus === 'active' &&
              wedding.health &&
              wedding.health.daysUntilWedding >= 0,
          ).length,
        },
        managedWeddings,
      }
    })

    const weddings = weddingIndex.map((wedding) => {
      const planningTeam = weddingPlanningMembers
        .filter((member) => member.weddingId === wedding.weddingId)
        .map((member) => ({
          membershipId: member.membershipId,
          userId: member.plannerUserId,
          name: member.plannerName,
          email: member.plannerEmail,
          role: member.role,
          status: member.status,
          businessAccountId: member.businessAccountId,
          businessName: member.businessName,
          acceptedAt: member.acceptedAt?.toISOString() || null,
          revokedAt: member.revokedAt?.toISOString() || null,
        }))
      const activePlanningTeam = planningTeam.filter((member) => member.status === 'active')
      const invitedPlanningTeam = planningTeam.filter((member) => member.status === 'invited')
      const intelligenceSummary = intelligenceByWedding.get(wedding.weddingId)

      return {
        ...(intelligenceSummary || {
          weddingId: wedding.weddingId,
          slug: wedding.slug,
          title: wedding.title,
          date: wedding.date.toISOString(),
          venue: wedding.venue,
          venueCity: wedding.venueCity,
          venueCountry: wedding.venueCountry,
          coupleId: wedding.coupleId,
          coupleName: [wedding.partner1, wedding.partner2].filter(Boolean).join(' & ') || 'Couple',
        }),
        planningTeam,
        activePlanningTeam,
        invitedPlanningTeam,
        hasActivePlanner: activePlanningTeam.length > 0,
      }
    })

    const activeRelationshipRows = weddingPlanningMembers.filter((member) => member.status === 'active')
    const invitedRelationshipRows = weddingPlanningMembers.filter((member) => member.status === 'invited')
    const metrics = {
      planningBusinesses: profiles.length,
      activeCompleteBusinesses: profiles.filter((row) => row.businessStatus === 'active' && row.onboardingStatus === 'complete').length,
      profilesNotStarted: profiles.filter((row) => !row.id).length,
      draftProfiles: profiles.filter((row) => row.profileState === 'draft').length,
      submittedProfiles: profiles.filter((row) => row.profileState === 'submitted').length,
      publishedProfiles: profiles.filter((row) => row.profileState === 'published').length,
      plannerManagedWeddings: weddings.filter((wedding) => wedding.hasActivePlanner).length,
      weddingsWithoutActivePlanner: weddings.filter((wedding) => !wedding.hasActivePlanner).length,
      pendingPlannerRelationships: invitedRelationshipRows.length,
      activePlanningProfessionals: new Set(activeRelationshipRows.map((member) => member.plannerUserId)).size,
      weddingsNeedingAttention: weddings.filter((wedding) => wedding.health?.state === 'attention').length,
      weddingsAtRisk: weddings.filter((wedding) => wedding.health?.state === 'at_risk').length,
    }

    return NextResponse.json({ success: true, profiles, weddings, metrics })
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
