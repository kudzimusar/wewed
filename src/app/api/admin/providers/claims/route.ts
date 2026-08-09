import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'

const OPEN_CLAIM_STATUSES = ['pending', 'verification_required']
const CLAIMABLE_LISTING_STATUSES = ['unclaimed', 'claim_pending']

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function adminError(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  console.error('[admin/providers/claims] Error:', error)
  return NextResponse.json({ success: false, error: 'Unable to process provider claims.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, 'admin.accounts.read')
    const status = text(request.nextUrl.searchParams.get('status'), 40) || null
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         c.*,
         p.slug,
         p."displayName",
         p."listingStatus",
         p."sourceSummary",
         ba.name AS "businessAccountName",
         ba.type AS "businessAccountType"
       FROM wewed_admin."ProviderClaimRequest" c
       JOIN wewed_admin."ProviderProfile" p ON p.id = c."providerProfileId"
       JOIN wewed_admin."BusinessAccount" ba ON ba.id = c."businessAccountId"
       WHERE ($1::text IS NULL OR c.status = $1)
       ORDER BY
         CASE c.status WHEN 'pending' THEN 0 WHEN 'verification_required' THEN 1 ELSE 2 END,
         c."createdAt" DESC
       LIMIT 250`,
      status,
    )
    return NextResponse.json({ success: true, claims: rows })
  } catch (error) {
    return adminError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireWewedAdmin(request, 'admin.accounts.approve')
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const claimId = text(body?.claimId, 200)
    const action = text(body?.action, 40)
    const reviewNotes = text(body?.reviewNotes, 3000) || null

    if (!claimId || !['approve', 'verification_required', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Claim ID and a supported review action are required.' }, { status: 400 })
    }

    const rows = await db.$queryRawUnsafe<Array<{
      id: string
      providerProfileId: string
      businessAccountId: string
      claimantEmail: string
      claimantName: string
      status: string
      displayName: string
      slug: string
    }>>(
      `SELECT
         c.id,
         c."providerProfileId",
         c."businessAccountId",
         c."claimantEmail",
         c."claimantName",
         c.status,
         p."displayName",
         p.slug
       FROM wewed_admin."ProviderClaimRequest" c
       JOIN wewed_admin."ProviderProfile" p ON p.id = c."providerProfileId"
       WHERE c.id = $1
       LIMIT 1`,
      claimId,
    )
    const claim = rows[0]
    if (!claim) return NextResponse.json({ success: false, error: 'Claim request not found.' }, { status: 404 })
    if (!OPEN_CLAIM_STATUSES.includes(claim.status)) {
      return NextResponse.json({ success: false, error: 'This claim has already been resolved.' }, { status: 409 })
    }

    if (action === 'verification_required') {
      const transitioned = await db.$transaction(async (transaction) => {
        await transaction.$queryRawUnsafe(
          `SELECT id FROM wewed_admin."ProviderProfile" WHERE id = $1 FOR UPDATE`,
          claim.providerProfileId,
        )
        const updated = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
          `UPDATE wewed_admin."ProviderClaimRequest"
           SET status = 'verification_required', "reviewNotes" = $2,
               "reviewedByUserId" = $3, "reviewedAt" = CURRENT_TIMESTAMP,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1 AND status IN ('pending', 'verification_required')
           RETURNING id`,
          claimId,
          reviewNotes,
          admin.session.userId,
        )
        return updated.length === 1
      })
      if (!transitioned) {
        return NextResponse.json({ success: false, error: 'This claim has already been resolved.' }, { status: 409 })
      }
      await writeBusinessAudit({
        actorUserId: admin.session.userId,
        businessAccountId: claim.businessAccountId,
        action: 'provider_claim.verification_required',
        resourceType: 'provider_claim',
        resourceId: claimId,
        details: { reviewNotes },
      })
      return NextResponse.json({ success: true, status: 'verification_required' })
    }

    if (action === 'reject') {
      const transitioned = await db.$transaction(async (transaction) => {
        await transaction.$queryRawUnsafe(
          `SELECT id FROM wewed_admin."ProviderProfile" WHERE id = $1 FOR UPDATE`,
          claim.providerProfileId,
        )
        const updated = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
          `UPDATE wewed_admin."ProviderClaimRequest"
           SET status = 'rejected', "reviewNotes" = $2,
               "reviewedByUserId" = $3, "reviewedAt" = CURRENT_TIMESTAMP,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1 AND status IN ('pending', 'verification_required')
           RETURNING id`,
          claimId,
          reviewNotes,
          admin.session.userId,
        )
        if (updated.length !== 1) return false

        const otherOpen = await transaction.$queryRawUnsafe<Array<{ count: number }>>(
          `SELECT count(*)::int AS count
           FROM wewed_admin."ProviderClaimRequest"
           WHERE "providerProfileId" = $1
             AND id <> $2
             AND status IN ('pending', 'verification_required')`,
          claim.providerProfileId,
          claimId,
        )
        if ((otherOpen[0]?.count ?? 0) === 0) {
          await transaction.$executeRawUnsafe(
            `UPDATE wewed_admin."ProviderProfile"
             SET "listingStatus" = 'unclaimed',
                 "claimNotice" = 'Own this business? Claim this listing to verify and manage it.',
                 "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $1 AND "listingStatus" IN ('unclaimed', 'claim_pending')`,
            claim.providerProfileId,
          )
        }
        return true
      })
      if (!transitioned) {
        return NextResponse.json({ success: false, error: 'This claim has already been resolved.' }, { status: 409 })
      }
      await writeBusinessAudit({
        actorUserId: admin.session.userId,
        businessAccountId: claim.businessAccountId,
        action: 'provider_claim.rejected',
        resourceType: 'provider_claim',
        resourceId: claimId,
        details: { reviewNotes },
      })
      return NextResponse.json({ success: true, status: 'rejected' })
    }

    const claimant = await db.user.findFirst({
      where: { email: { equals: claim.claimantEmail, mode: 'insensitive' }, isActive: true },
      select: { id: true, email: true },
    })
    if (!claimant) {
      return NextResponse.json(
        {
          success: false,
          error: 'The claimant must first create and confirm a Wewed account using the same email address before approval.',
          requiredEmail: claim.claimantEmail,
        },
        { status: 409 },
      )
    }

    const approval = await db.$transaction(async (transaction) => {
      const lockedProfiles = await transaction.$queryRawUnsafe<Array<{ listingStatus: string }>>(
        `SELECT "listingStatus"
         FROM wewed_admin."ProviderProfile"
         WHERE id = $1
         FOR UPDATE`,
        claim.providerProfileId,
      )
      const lockedProfile = lockedProfiles[0]
      if (!lockedProfile || !CLAIMABLE_LISTING_STATUSES.includes(lockedProfile.listingStatus)) {
        return { approved: false as const }
      }

      const lockedClaims = await transaction.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT status
         FROM wewed_admin."ProviderClaimRequest"
         WHERE id = $1
         FOR UPDATE`,
        claimId,
      )
      const lockedClaim = lockedClaims[0]
      if (!lockedClaim || !OPEN_CLAIM_STATUSES.includes(lockedClaim.status)) {
        return { approved: false as const }
      }

      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccountMember" (
           id, "businessAccountId", "userId", role, status, permissions,
           "createdAt", "updatedAt"
         ) VALUES ($1,$2,$3,'business_owner','active','[]'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("businessAccountId", "userId") DO UPDATE SET
           role = 'business_owner', status = 'active', "updatedAt" = CURRENT_TIMESTAMP`,
        createBusinessId('business-member'),
        claim.businessAccountId,
        claimant.id,
      )

      await transaction.$executeRawUnsafe(
        `UPDATE wewed_admin."BusinessAccount"
         SET "ownerUserId" = $2,
             "onboardingStatus" = 'complete',
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{marketplaceListing}',
               COALESCE(metadata->'marketplaceListing', '{}'::jsonb) || $3::jsonb,
               true
             ),
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        claim.businessAccountId,
        claimant.id,
        JSON.stringify({
          status: 'claimed',
          approvedClaimId: claimId,
          approvedByUserId: admin.session.userId,
          approvedAt: new Date().toISOString(),
        }),
      )

      await transaction.$executeRawUnsafe(
        `UPDATE wewed_admin."ProviderProfile"
         SET "listingStatus" = 'claimed',
             "isClaimable" = false,
             "acceptingEnquiries" = false,
             "claimNotice" = 'Ownership verified. The business owner is completing this profile.',
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        claim.providerProfileId,
      )

      await transaction.$executeRawUnsafe(
        `UPDATE wewed_admin."ProviderClaimRequest"
         SET status = 'approved', "claimantUserId" = $4, "reviewNotes" = $2,
             "reviewedByUserId" = $3, "reviewedAt" = CURRENT_TIMESTAMP,
             "approvedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        claimId,
        reviewNotes,
        admin.session.userId,
        claimant.id,
      )

      await transaction.$executeRawUnsafe(
        `UPDATE wewed_admin."ProviderClaimRequest"
         SET status = 'rejected',
             "reviewNotes" = COALESCE("reviewNotes", '') || ' Superseded by an approved ownership claim.',
             "reviewedByUserId" = $3, "reviewedAt" = CURRENT_TIMESTAMP,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "providerProfileId" = $1 AND id <> $2
           AND status IN ('pending', 'verification_required')`,
        claim.providerProfileId,
        claimId,
        admin.session.userId,
      )

      return { approved: true as const }
    })

    if (!approval.approved) {
      return NextResponse.json(
        { success: false, error: 'Another ownership claim has already been approved or resolved for this provider.' },
        { status: 409 },
      )
    }

    await writeBusinessAudit({
      actorUserId: admin.session.userId,
      businessAccountId: claim.businessAccountId,
      action: 'provider_claim.approved',
      resourceType: 'provider_claim',
      resourceId: claimId,
      details: {
        claimantUserId: claimant.id,
        claimantEmail: claimant.email,
        providerProfileId: claim.providerProfileId,
        authorityCreated: true,
        enquiriesRemainDisabledUntilOwnerPublication: true,
      },
    })

    return NextResponse.json({
      success: true,
      status: 'approved',
      claimantUserId: claimant.id,
      businessAccountId: claim.businessAccountId,
      profileSlug: claim.slug,
      nextStep: 'The owner can now open Manage profile, confirm the imported details and publish an enquiry-ready profile.',
    })
  } catch (error) {
    return adminError(error)
  }
}

export const dynamic = 'force-dynamic'
