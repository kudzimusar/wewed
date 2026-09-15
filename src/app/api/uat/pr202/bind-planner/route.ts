import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession } from '@/lib/app-session'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'
const WEDDING_ID = 'wewed-pr202-uat-20260912'
const WEDDING_TITLE = 'Wewed PR 202 — Synthetic UAT'

/**
 * Temporary, idempotent PR #202 UAT repair endpoint.
 *
 * The original synthetic fixture provisioner created the wedding and
 * Contributions data but did not attach the authenticated UAT Planner to that
 * wedding. Keep this route unavailable everywhere except the exact PR preview.
 */
export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== BRANCH
  ) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Planner sign-in is required.' },
      { status: 401 },
    )
  }
  if (session.role !== 'planner') {
    return NextResponse.json(
      { success: false, error: 'This UAT repair is restricted to Planner sessions.' },
      { status: 403 },
    )
  }

  const [planner, wedding] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, isActive: true },
    }),
    db.wedding.findUnique({
      where: { id: WEDDING_ID },
      select: { id: true, slug: true, title: true },
    }),
  ])

  if (!planner || planner.role !== 'planner' || !planner.isActive) {
    return NextResponse.json(
      { success: false, error: 'The signed-in account is not an active Planner.' },
      { status: 403 },
    )
  }

  if (
    !wedding ||
    wedding.slug !== WEDDING_ID ||
    wedding.title !== WEDDING_TITLE
  ) {
    return NextResponse.json(
      { success: false, error: 'Synthetic PR #202 UAT wedding not found.' },
      { status: 409 },
    )
  }

  const result = await db.$transaction(async (tx) => {
    const membershipId = `pr202-planner-${planner.id}`

    await tx.$executeRaw`
      INSERT INTO public."WeddingMembership"
        (id,"userId","weddingId",role,status,permissions,"acceptedAt","createdAt","updatedAt")
      VALUES
        (${membershipId},${planner.id},${WEDDING_ID},'planner','active',NULL,NOW(),NOW(),NOW())
      ON CONFLICT ("userId","weddingId") DO UPDATE SET
        role='planner',
        status='active',
        "acceptedAt"=COALESCE(public."WeddingMembership"."acceptedAt",NOW()),
        "revokedAt"=NULL,
        "updatedAt"=NOW()
    `

    const planningAccounts = await tx.$queryRaw<Array<{ businessAccountId: string }>>`
      SELECT bam."businessAccountId" AS "businessAccountId"
      FROM public."BusinessAccountMember" bam
      JOIN public."BusinessAccount" ba
        ON ba.id = bam."businessAccountId"
      WHERE bam."userId" = ${planner.id}
        AND bam.status = 'active'
        AND ba.type = 'planning_company'
        AND ba.status = 'active'
        AND ba."onboardingStatus" = 'complete'
      ORDER BY
        CASE WHEN ba."ownerUserId" = ${planner.id} THEN 0 ELSE 1 END,
        ba."createdAt" ASC
    `

    if (planningAccounts.length === 0) {
      throw new Error('Active Planner has no governed planning-company account.')
    }

    for (const account of planningAccounts) {
      const linkId = `pr202-manages-${account.businessAccountId}-${WEDDING_ID}`
      await tx.$executeRaw`
        INSERT INTO public."BusinessAccountLink"
          (id,"businessAccountId","entityType","entityId",relationship)
        VALUES
          (${linkId},${account.businessAccountId},'wedding',${WEDDING_ID},'manages')
        ON CONFLICT ("businessAccountId","entityType","entityId") DO UPDATE SET
          relationship='manages'
      `
    }

    return {
      membershipId,
      planningBusinessLinks: planningAccounts.length,
    }
  })

  return NextResponse.json({
    success: true,
    wedding: { id: wedding.id, title: wedding.title },
    membership: { role: 'planner', status: 'active' },
    planningBusinessLinks: result.planningBusinessLinks,
  })
}
