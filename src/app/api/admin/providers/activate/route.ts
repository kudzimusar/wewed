import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createBusinessId, requireWewedAdmin, WewedAdminAccessError } from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'

function value(value: unknown, max = 160): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  console.error('[api/admin/providers/activate] Error:', error)
  return NextResponse.json({ success: false, error: 'Unable to activate vendor access.' }, { status: 500 })
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.accounts.approve')
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const accountId = value(body.accountId)
    const featured = body.featured === true

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Vendor account is required.' }, { status: 400 })
    }

    const rows = await db.$queryRawUnsafe<Array<{
      id: string
      name: string
      ownerUserId: string
      ownerEmail: string
      ownerName: string | null
      authUserId: string | null
      memberId: string
      profileId: string | null
    }>>(
      `SELECT ba.id, ba.name, ba."ownerUserId", u.email AS "ownerEmail", u.name AS "ownerName",
              NULLIF(ba.metadata->>'authUserId', '') AS "authUserId",
              bam.id AS "memberId", p.id AS "profileId"
       FROM public."BusinessAccount" ba
       JOIN public."User" u ON u.id = ba."ownerUserId"
       JOIN public."BusinessAccountMember" bam
         ON bam."businessAccountId" = ba.id AND bam."userId" = ba."ownerUserId"
       LEFT JOIN public."ProviderProfile" p ON p."businessAccountId" = ba.id
       WHERE ba.id = $1
         AND ba.type = 'vendor'
         AND ba.status = 'active'
         AND ba."sourceType" = 'public_registration'
       LIMIT 1`,
      accountId,
    )
    const account = rows[0]
    if (!account || !account.profileId) {
      return NextResponse.json({ success: false, error: 'Approved vendor application was not found.' }, { status: 404 })
    }
    if (!account.authUserId) {
      return NextResponse.json({ success: false, error: 'Vendor application is missing its authentication identity.' }, { status: 409 })
    }

    const now = new Date()
    const badges = featured ? ['Wewed Approved', 'Wewed Featured'] : ['Wewed Approved']

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: account.ownerUserId },
        data: { role: 'vendor', coupleId: null, currentWeddingId: null, isActive: true },
      })
      await tx.userProfile.upsert({
        where: { id: account.authUserId! },
        create: {
          id: account.authUserId!,
          email: account.ownerEmail,
          displayName: account.name,
          role: 'vendor',
        },
        update: {
          email: account.ownerEmail,
          displayName: account.name,
          role: 'vendor',
          coupleId: null,
          isBanned: false,
          bannedAt: null,
          banReason: null,
        },
      })
      await tx.$executeRawUnsafe(
        `UPDATE public."BusinessAccountMember"
         SET role = 'business_owner', status = 'active',
             permissions = '["account.manage","profile.manage","enquiries.manage","communications.manage"]'::jsonb,
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
        JSON.stringify({ vendorPortalReady: true, onboardingCompletedAt: now.toISOString() }),
      )
      await tx.$executeRawUnsafe(
        `UPDATE public."ProviderProfile"
         SET "listingStatus" = 'verified', visibility = 'published', "isClaimable" = false,
             "acceptingEnquiries" = true, "ownerConfirmedAt" = COALESCE("ownerConfirmedAt", CURRENT_TIMESTAMP),
             "publishedAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP),
             "verificationBadges" = $2::jsonb,
             "lastProfileUpdate" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "businessAccountId" = $1`,
        account.id,
        JSON.stringify(badges),
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO public."BusinessAuditLog"
          (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
         VALUES ($1, $2, $3, 'provider.vendor_access_activated', 'BusinessAccount', $3, $4::jsonb)`,
        createBusinessId('audit'),
        context.session.userId,
        account.id,
        JSON.stringify({ featured, listingStatus: 'verified', role: 'vendor' }),
      )
    })

    return NextResponse.json({
      success: true,
      accountId: account.id,
      profileId: account.profileId,
      displayName: account.name,
      role: 'vendor',
      listingStatus: 'verified',
      featured,
    })
  } catch (error) {
    return errorResponse(error)
  }
}