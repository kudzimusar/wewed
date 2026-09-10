import { NextRequest, NextResponse } from 'next/server'
import {
  PLANNER_PORTFOLIO_SESSION_ID,
  VENDOR_PORTFOLIO_SESSION_ID,
  createAppSessionToken,
  isDashboardRole,
  readBearerAppSession,
} from '@/lib/app-session'
import {
  WEWED_PLATFORM_SESSION_ID,
  isWewedPlatformAdministrator,
} from '@/lib/business-access'
import { db } from '@/lib/db'
import { listAccessibleWeddings } from '@/lib/wedding-access'

function unauthorized(message = 'Your mobile session is no longer valid.') {
  return NextResponse.json(
    { success: false, authorized: false, error: message },
    { status: 401, headers: { 'cache-control': 'no-store' } },
  )
}

async function activeVendorIdentity(userId: string): Promise<{ businessAccountId: string; businessName: string } | null> {
  const rows = await db.$queryRawUnsafe<Array<{ businessAccountId: string; businessName: string }>>(
    `SELECT ba.id AS "businessAccountId", ba.name AS "businessName"
     FROM public."BusinessAccountMember" bam
     JOIN public."BusinessAccount" ba
       ON ba.id = bam."businessAccountId"
      AND ba.type = 'vendor'
      AND ba.status = 'active'
      AND ba."onboardingStatus" = 'complete'
     JOIN public."ProviderProfile" profile
       ON profile."businessAccountId" = ba.id
      AND profile."listingStatus" IN ('claimed', 'verified')
      AND profile.visibility = 'published'
      AND profile."isClaimable" = false
     WHERE bam."userId" = $1
       AND bam.status = 'active'
       AND bam.role IN ('business_owner', 'vendor_manager')
     ORDER BY CASE WHEN ba."ownerUserId" = $1 THEN 0 ELSE 1 END, ba."createdAt" ASC
     LIMIT 1`,
    userId,
  )
  return rows[0] ?? null
}

export async function GET(request: NextRequest) {
  const session = readBearerAppSession(request)
  if (!session) return unauthorized()

  const [accessUser, profile] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        coupleId: true,
        currentWeddingId: true,
        isActive: true,
      },
    }),
    db.userProfile.findUnique({
      where: { id: session.authUserId },
      select: { displayName: true, avatarUrl: true, isBanned: true },
    }),
  ])

  if (
    !accessUser ||
    !accessUser.isActive ||
    !isDashboardRole(accessUser.role) ||
    accessUser.role !== session.role ||
    accessUser.email.toLowerCase() !== session.email.toLowerCase() ||
    profile?.isBanned
  ) {
    return unauthorized()
  }

  const displayName = profile?.displayName ?? accessUser.name ?? accessUser.email
  const commonUser = {
    id: session.authUserId,
    accessUserId: accessUser.id,
    email: accessUser.email,
    displayName,
    avatarUrl: profile?.avatarUrl ?? null,
    role: accessUser.role,
    coupleId: accessUser.coupleId,
  }

  if (accessUser.role === 'admin' && await isWewedPlatformAdministrator(accessUser.id)) {
    const sessionToken = createAppSessionToken({
      userId: accessUser.id,
      authUserId: session.authUserId,
      email: accessUser.email,
      role: 'admin',
      coupleId: null,
      activeWeddingId: WEWED_PLATFORM_SESSION_ID,
    })

    return NextResponse.json({
      success: true,
      authorized: true,
      user: { ...commonUser, coupleId: null, activeWeddingId: WEWED_PLATFORM_SESSION_ID },
      activeWedding: null,
      weddings: [],
      workspace: 'wewed_platform',
      sessionToken,
    }, { headers: { 'cache-control': 'no-store' } })
  }

  if (accessUser.role === 'vendor') {
    const vendor = await activeVendorIdentity(accessUser.id)
    if (!vendor) return unauthorized('This vendor profile is no longer approved for owner-managed access.')

    const sessionToken = createAppSessionToken({
      userId: accessUser.id,
      authUserId: session.authUserId,
      email: accessUser.email,
      role: 'vendor',
      coupleId: null,
      activeWeddingId: VENDOR_PORTFOLIO_SESSION_ID,
    })

    return NextResponse.json({
      success: true,
      authorized: true,
      user: { ...commonUser, displayName: vendor.businessName, coupleId: null, activeWeddingId: VENDOR_PORTFOLIO_SESSION_ID },
      activeWedding: null,
      weddings: [],
      workspace: 'vendor_portfolio',
      businessAccountId: vendor.businessAccountId,
      sessionToken,
    }, { headers: { 'cache-control': 'no-store' } })
  }

  const weddings = await listAccessibleWeddings(accessUser.id, accessUser.role)
  const activeMemberships = weddings.filter((wedding) => wedding.membershipStatus === 'active')

  if (accessUser.role === 'planner' && session.activeWeddingId === PLANNER_PORTFOLIO_SESSION_ID) {
    const sessionToken = createAppSessionToken({
      userId: accessUser.id,
      authUserId: session.authUserId,
      email: accessUser.email,
      role: 'planner',
      coupleId: accessUser.coupleId,
      activeWeddingId: PLANNER_PORTFOLIO_SESSION_ID,
    })

    return NextResponse.json({
      success: true,
      authorized: true,
      user: { ...commonUser, activeWeddingId: PLANNER_PORTFOLIO_SESSION_ID },
      activeWedding: null,
      weddings,
      workspace: 'planner_portfolio',
      sessionToken,
    }, { headers: { 'cache-control': 'no-store' } })
  }

  let activeWedding = activeMemberships.find((wedding) => wedding.id === session.activeWeddingId) ?? null
  if (!activeWedding) activeWedding = activeMemberships[0] ?? null

  if (!activeWedding) {
    if (accessUser.role === 'planner') {
      const sessionToken = createAppSessionToken({
        userId: accessUser.id,
        authUserId: session.authUserId,
        email: accessUser.email,
        role: 'planner',
        coupleId: accessUser.coupleId,
        activeWeddingId: PLANNER_PORTFOLIO_SESSION_ID,
      })
      return NextResponse.json({
        success: true,
        authorized: true,
        user: { ...commonUser, activeWeddingId: PLANNER_PORTFOLIO_SESSION_ID },
        activeWedding: null,
        weddings,
        workspace: 'planner_portfolio',
        sessionToken,
      }, { headers: { 'cache-control': 'no-store' } })
    }
    return unauthorized('This account no longer has an active wedding workspace.')
  }

  if (accessUser.currentWeddingId !== activeWedding.id) {
    await db.user.update({ where: { id: accessUser.id }, data: { currentWeddingId: activeWedding.id } })
  }

  const sessionToken = createAppSessionToken({
    userId: accessUser.id,
    authUserId: session.authUserId,
    email: accessUser.email,
    role: accessUser.role,
    coupleId: accessUser.coupleId,
    activeWeddingId: activeWedding.id,
  })

  return NextResponse.json({
    success: true,
    authorized: true,
    user: { ...commonUser, activeWeddingId: activeWedding.id },
    activeWedding,
    weddings,
    workspace: 'wedding',
    sessionToken,
  }, { headers: { 'cache-control': 'no-store' } })
}
