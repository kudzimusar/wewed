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

/**
 * Thrown when the row-lock re-check (master plan Phase 7 §13) finds the account already
 * completed by a request that won a genuine race. Distinct from the pre-transaction
 * `onboardingStatus === 'complete'` check above: that one catches a sequential retry after a
 * prior request has already committed and returned; this one catches two near-simultaneous
 * completions racing each other, where both pass the pre-transaction check before either commits.
 */
class OnboardingAlreadyInProgressError extends Error {
  constructor() {
    super('Onboarding for this application was just completed by another request. Refresh and check its current status.')
  }
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof OnboardingAlreadyInProgressError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 409 })
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

    // Registration is the only writer that may establish the Supabase-auth -> UserProfile link.
    // Admin completion must prove that exact profile still exists and still belongs to this owner;
    // it must never recreate/rebind an auth identity from BusinessAccount metadata.
    const authProfile = await db.userProfile.findUnique({
      where: { id: authUserId },
      select: { email: true },
    })
    if (!authProfile || authProfile.email.toLowerCase() !== account.ownerEmail.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'The application authentication identity link is inconsistent and must be reconciled before onboarding.' },
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
        // Master plan Phase 7 §13 — the pre-transaction reads above (account.onboardingStatus,
        // account.status) are an ordinary SELECT, not SELECT ... FOR UPDATE: two near-simultaneous
        // admin completions for the SAME accountId can both pass them before either commits.
        // `wewed_admin."BusinessAccount"."onboardingStatus" = 'in_progress'` is NOT a free value
        // to repurpose as a claim marker: the pre-existing `validate_business_lifecycle` trigger
        // already sets it the moment an admin approves a public-registration account
        // (pending_review -> active), so every real approved-but-incomplete account already sits
        // at 'in_progress' before this route ever runs — reusing it as a claim would make the
        // claim fail unconditionally. Instead, take a real row lock as the first statement in the
        // transaction and re-read the committed value after acquiring it: the loser of a genuine
        // race blocks on FOR UPDATE until the winner commits, then observes 'complete' and aborts
        // before creating anything duplicate.
        const [locked] = await tx.$queryRawUnsafe<Array<{ onboardingStatus: string }>>(
          `SELECT "onboardingStatus" FROM wewed_admin."BusinessAccount" WHERE id = $1 FOR UPDATE`,
          account.id,
        )
        if (!locked || locked.onboardingStatus === 'complete') {
          throw new OnboardingAlreadyInProgressError()
        }

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
        await tx.userProfile.update({
          where: { id: authUserId },
          data: {
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

    // Planning-company onboarding is intentionally independent from having a client wedding.
    // An existing wedding can still be attached here for a controlled legacy/admin workflow,
    // but marketplace activation and professional profile setup must not depend on it.
    const weddingId = text(body.weddingId, 120)
    if (weddingId) {
      const wedding = await db.wedding.findUnique({
        where: { id: weddingId },
        select: { id: true },
      })
      if (!wedding) {
        return NextResponse.json({ success: false, error: 'Assigned wedding was not found.' }, { status: 404 })
      }
    }

    const weddingRole = account.memberRole === 'coordinator' ? 'coordinator' : 'planner'
    await db.$transaction(async (tx) => {
      // Same row-lock re-check as the Couple branch (master plan Phase 7 §13), applied uniformly
      // even though every other write in this branch is already an upsert: it keeps the
      // onboardingStatus transition itself race-free and prevents a duplicate BusinessAuditLog
      // entry from a genuine concurrent double-submit.
      const [locked] = await tx.$queryRawUnsafe<Array<{ onboardingStatus: string }>>(
        `SELECT "onboardingStatus" FROM wewed_admin."BusinessAccount" WHERE id = $1 FOR UPDATE`,
        account.id,
      )
      if (!locked || locked.onboardingStatus === 'complete') {
        throw new OnboardingAlreadyInProgressError()
      }

      await tx.user.update({
        where: { id: account.ownerUserId },
        data: {
          role: 'planner',
          coupleId: null,
          currentWeddingId: weddingId || null,
          isActive: true,
        },
      })
      await tx.userProfile.update({
        where: { id: authUserId },
        data: {
          email: account.ownerEmail,
          displayName: account.ownerName,
          role: 'planner',
          coupleId: null,
          isBanned: false,
          bannedAt: null,
          banReason: null,
        },
      })

      if (weddingId) {
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
      }

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
          provisionedWeddingId: weddingId || null,
          plannerMarketplaceReady: true,
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
        JSON.stringify({
          accountType: account.type,
          marketplaceReady: true,
          weddingId: weddingId || null,
          weddingRole: weddingId ? weddingRole : null,
        }),
      )
    })

    return NextResponse.json({ success: true, weddingId: weddingId || null, marketplaceReady: true })
  } catch (error) {
    return errorResponse(error)
  }
}
