import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
} from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'wewed'
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }

  console.error('[api/admin/onboarding] Error:', error)
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : 'Unable to complete onboarding.' },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, 'admin.accounts.read')

    const [accounts, weddings] = await Promise.all([
      db.$queryRawUnsafe<Array<{
        id: string
        name: string
        type: string
        status: string
        onboardingStatus: string
        subscriptionPlan: string
        ownerUserId: string
        ownerEmail: string
        ownerName: string | null
        memberRole: string
        memberStatus: string
        metadata: Record<string, unknown>
      }>>(`
        SELECT ba.id, ba.name, ba.type, ba.status,
          ba."onboardingStatus", ba."subscriptionPlan",
          ba."ownerUserId", u.email AS "ownerEmail", u.name AS "ownerName",
          bam.role AS "memberRole", bam.status AS "memberStatus", ba.metadata
        FROM public."BusinessAccount" ba
        JOIN public."User" u ON u.id = ba."ownerUserId"
        JOIN public."BusinessAccountMember" bam
          ON bam."businessAccountId" = ba.id
         AND bam."userId" = ba."ownerUserId"
        WHERE ba."sourceType" = 'public_registration'
          AND ba.status = 'active'
          AND ba."onboardingStatus" <> 'complete'
        ORDER BY ba."createdAt" ASC
      `),
      db.wedding.findMany({
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
          coupleId: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      accounts: accounts.map((account) => {
        const metadata = objectValue(account.metadata)
        return {
          ...account,
          metadata: undefined,
          applicantName: typeof metadata.applicantName === 'string' ? metadata.applicantName : account.ownerName,
          applicantEmail: typeof metadata.applicantEmail === 'string' ? metadata.applicantEmail : account.ownerEmail,
          requestedRole: typeof metadata.requestedRole === 'string' ? metadata.requestedRole : account.memberRole,
          requestedPlan: typeof metadata.requestedPlan === 'string' ? metadata.requestedPlan : account.subscriptionPlan,
        }
      }),
      weddings: weddings.map((wedding) => ({
        ...wedding,
        date: wedding.date.toISOString(),
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.accounts.approve')
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 60)
    const accountId = text(body.accountId, 120)

    if (action !== 'complete_onboarding' || !accountId) {
      return NextResponse.json(
        { success: false, error: 'A valid onboarding action and account are required.' },
        { status: 400 },
      )
    }

    const rows = await db.$queryRawUnsafe<Array<{
      id: string
      name: string
      type: string
      status: string
      onboardingStatus: string
      subscriptionPlan: string
      ownerUserId: string
      ownerEmail: string
      ownerName: string | null
      memberId: string
      memberRole: string
      metadata: Record<string, unknown>
    }>>(
      `SELECT ba.id, ba.name, ba.type, ba.status, ba."onboardingStatus",
        ba."subscriptionPlan", ba."ownerUserId", u.email AS "ownerEmail",
        u.name AS "ownerName", bam.id AS "memberId", bam.role AS "memberRole", ba.metadata
       FROM public."BusinessAccount" ba
       JOIN public."User" u ON u.id = ba."ownerUserId"
       JOIN public."BusinessAccountMember" bam
         ON bam."businessAccountId" = ba.id
        AND bam."userId" = ba."ownerUserId"
       WHERE ba.id = $1 AND ba."sourceType" = 'public_registration'
       LIMIT 1`,
      accountId,
    )

    const account = rows[0]
    if (!account) {
      return NextResponse.json({ success: false, error: 'Public application was not found.' }, { status: 404 })
    }
    if (account.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Approve the account before completing internal onboarding.' },
        { status: 409 },
      )
    }
    if (account.onboardingStatus === 'complete') {
      return NextResponse.json({ success: false, error: 'Onboarding is already complete.' }, { status: 409 })
    }

    const metadata = objectValue(account.metadata)
    const authUserId = typeof metadata.authUserId === 'string' ? metadata.authUserId : ''
    if (!authUserId) {
      return NextResponse.json(
        { success: false, error: 'The application is missing its authentication identity link.' },
        { status: 409 },
      )
    }

    if (!['couple', 'planning_company'].includes(account.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'This account may be approved as a business record, but login activation is blocked until its dedicated stakeholder portal is available.',
        },
        { status: 409 },
      )
    }

    if (account.type === 'couple') {
      const partner1 = text(body.partner1, 100)
      const partner2 = text(body.partner2, 100)
      const weddingTitle = text(body.weddingTitle, 180) || `${partner1} & ${partner2}`
      const weddingDate = new Date(text(body.weddingDate, 40))
      const venue = text(body.venue, 180)
      const venueCity = text(body.venueCity, 120)
      const venueCountry = text(body.venueCountry, 120)

      if (!partner1 || !partner2 || Number.isNaN(weddingDate.getTime()) || !venue || !venueCity || !venueCountry) {
        return NextResponse.json(
          { success: false, error: 'Both partners, wedding date, venue, city and country are required.' },
          { status: 400 },
        )
      }

      const result = await db.$transaction(async (tx) => {
        const suffix = account.id.slice(-8)
        const couple = await tx.couple.create({
          data: {
            slug: `${slugify(`${partner1}-${partner2}`)}-${suffix}`,
            partner1,
            partner2,
            userId: account.ownerUserId,
            subscriptionStatus: account.subscriptionPlan,
          },
        })
        const wedding = await tx.wedding.create({
          data: {
            slug: `${slugify(weddingTitle)}-${suffix}`,
            title: weddingTitle,
            date: weddingDate,
            venue,
            venueCity,
            venueCountry,
            coupleId: couple.id,
            subscriptionTier: account.subscriptionPlan,
          },
        })

        await tx.user.update({
          where: { id: account.ownerUserId },
          data: {
            role: 'couple',
            coupleId: couple.id,
            currentWeddingId: wedding.id,
            isActive: true,
          },
        })
        await tx.userProfile.upsert({
          where: { id: authUserId },
          create: {
            id: authUserId,
            email: account.ownerEmail,
            displayName: account.ownerName,
            role: 'couple',
            coupleId: couple.id,
          },
          update: {
            email: account.ownerEmail,
            displayName: account.ownerName,
            role: 'couple',
            coupleId: couple.id,
            isBanned: false,
            bannedAt: null,
            banReason: null,
          },
        })
        await tx.weddingMembership.upsert({
          where: { userId_weddingId: { userId: account.ownerUserId, weddingId: wedding.id } },
          create: {
            userId: account.ownerUserId,
            weddingId: wedding.id,
            role: 'owner',
            status: 'active',
            permissions: JSON.stringify(['*']),
            invitedById: context.session.userId,
            acceptedAt: new Date(),
          },
          update: {
            role: 'owner',
            status: 'active',
            permissions: JSON.stringify(['*']),
            acceptedAt: new Date(),
            revokedAt: null,
          },
        })
        await tx.$executeRawUnsafe(
          `INSERT INTO public."BusinessAccountLink"
            ("id", "businessAccountId", "entityType", "entityId", "relationship")
           VALUES ($1, $2, 'couple', $3, 'owns'), ($4, $2, 'wedding', $5, 'owns')
           ON CONFLICT ("businessAccountId", "entityType", "entityId") DO UPDATE SET
             relationship = EXCLUDED.relationship`,
          createBusinessId('link'),
          account.id,
          couple.id,
          createBusinessId('link'),
          wedding.id,
        )
        await tx.$executeRawUnsafe(
          `UPDATE public."BusinessAccountMember"
           SET role = 'couple_owner', status = 'active', permissions = '["account.manage","billing.manage","weddings.manage"]'::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          account.memberId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE public."BusinessAccount"
           SET "onboardingStatus" = 'complete',
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          account.id,
          JSON.stringify({
            provisionedCoupleId: couple.id,
            provisionedWeddingId: wedding.id,
            onboardingCompletedAt: new Date().toISOString(),
          }),
        )
        await tx.$executeRawUnsafe(
          `INSERT INTO public."BusinessAuditLog"
            ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
           VALUES ($1, $2, $3, 'business_account.onboarding_completed', 'BusinessAccount', $3, $4::jsonb)`,
          createBusinessId('audit'),
          context.session.userId,
          account.id,
          JSON.stringify({ accountType: account.type, coupleId: couple.id, weddingId: wedding.id }),
        )

        return { coupleId: couple.id, weddingId: wedding.id }
      })

      return NextResponse.json({ success: true, ...result })
    }

    const weddingId = text(body.weddingId, 120)
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Assign an existing wedding to complete planner onboarding.' },
        { status: 400 },
      )
    }

    const wedding = await db.wedding.findUnique({
      where: { id: weddingId },
      select: { id: true },
    })
    if (!wedding) {
      return NextResponse.json({ success: false, error: 'Assigned wedding was not found.' }, { status: 404 })
    }

    const weddingRole = account.memberRole === 'coordinator' ? 'coordinator' : 'planner'
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: account.ownerUserId },
        data: {
          role: 'planner',
          coupleId: null,
          currentWeddingId: weddingId,
          isActive: true,
        },
      })
      await tx.userProfile.upsert({
        where: { id: authUserId },
        create: {
          id: authUserId,
          email: account.ownerEmail,
          displayName: account.ownerName,
          role: 'planner',
        },
        update: {
          email: account.ownerEmail,
          displayName: account.ownerName,
          role: 'planner',
          coupleId: null,
          isBanned: false,
          bannedAt: null,
          banReason: null,
        },
      })
      await tx.weddingMembership.upsert({
        where: { userId_weddingId: { userId: account.ownerUserId, weddingId } },
        create: {
          userId: account.ownerUserId,
          weddingId,
          role: weddingRole,
          status: 'active',
          invitedById: context.session.userId,
          acceptedAt: new Date(),
        },
        update: {
          role: weddingRole,
          status: 'active',
          acceptedAt: new Date(),
          revokedAt: null,
        },
      })
      await tx.$executeRawUnsafe(
        `INSERT INTO public."BusinessAccountLink"
          ("id", "businessAccountId", "entityType", "entityId", "relationship")
         VALUES ($1, $2, 'wedding', $3, 'manages')
         ON CONFLICT ("businessAccountId", "entityType", "entityId") DO UPDATE SET
           relationship = EXCLUDED.relationship`,
        createBusinessId('link'),
        account.id,
        weddingId,
      )
      await tx.$executeRawUnsafe(
        `UPDATE public."BusinessAccountMember"
         SET status = 'active', permissions = '["account.manage","billing.manage","weddings.manage"]'::jsonb,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        account.memberId,
      )
      await tx.$executeRawUnsafe(
        `UPDATE public."BusinessAccount"
         SET "onboardingStatus" = 'complete',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        account.id,
        JSON.stringify({
          provisionedWeddingId: weddingId,
          onboardingCompletedAt: new Date().toISOString(),
        }),
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO public."BusinessAuditLog"
          ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
         VALUES ($1, $2, $3, 'business_account.onboarding_completed', 'BusinessAccount', $3, $4::jsonb)`,
        createBusinessId('audit'),
        context.session.userId,
        account.id,
        JSON.stringify({ accountType: account.type, weddingId, weddingRole }),
      )
    })

    return NextResponse.json({ success: true, weddingId })
  } catch (error) {
    return errorResponse(error)
  }
}
