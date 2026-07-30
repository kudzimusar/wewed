import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  clearAppSessionCookie,
  isDashboardRole,
  readAppSession,
  setAppSessionCookie,
  type AppSession,
} from '@/lib/app-session'
import {
  acceptPendingMemberships,
  listAccessibleWeddings,
} from '@/lib/wedding-access'

interface AccessUser {
  id: string
  email: string
  name: string | null
  role: string
  coupleId: string | null
  isActive: boolean
}

interface ProfileSummary {
  displayName: string | null
  avatarUrl: string | null
  isBanned: boolean
}

function signedOutResponse() {
  const response = NextResponse.json({
    success: true,
    authorized: false,
    user: null,
  })
  clearAppSessionCookie(response)
  return response
}

/**
 * Browser tests may bypass the external Supabase identity lookup only inside an
 * explicitly enabled GitHub Actions job using a local PostgreSQL database.
 * Vercel and non-local database targets can never activate this path.
 */
function isCiPlannerE2EMode(): boolean {
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? ''
  const localDatabase = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
  return (
    process.env.WEWED_E2E_MODE === '1' &&
    process.env.CI === 'true' &&
    !process.env.VERCEL &&
    localDatabase
  )
}

async function loadAccessUser(userId: string): Promise<AccessUser | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coupleId: true,
      isActive: true,
    },
  })
}

function accessUserMatchesSession(accessUser: AccessUser, appSession: AppSession): boolean {
  return (
    accessUser.email.toLowerCase() === appSession.email.toLowerCase() &&
    accessUser.isActive &&
    isDashboardRole(accessUser.role) &&
    accessUser.role === appSession.role &&
    accessUser.coupleId === appSession.coupleId
  )
}

async function authorizedResponse(input: {
  appSession: AppSession
  accessUser: AccessUser
  authUserId: string
  email: string
  profile: ProfileSummary | null
}) {
  const { appSession, accessUser, authUserId, email, profile } = input
  const dashboardRole = isDashboardRole(accessUser.role) ? accessUser.role : null
  if (!dashboardRole) return signedOutResponse()

  await acceptPendingMemberships(accessUser.id)
  const weddings = await listAccessibleWeddings(accessUser.id, dashboardRole)
  const activeWeddings = weddings.filter(
    (wedding) => wedding.membershipStatus === 'active',
  )

  if (activeWeddings.length === 0) return signedOutResponse()

  const activeWedding =
    activeWeddings.find(
      (wedding) => wedding.id === appSession.activeWeddingId,
    ) ?? activeWeddings[0]

  if (activeWedding.id !== appSession.activeWeddingId) {
    await db.$executeRawUnsafe(
      `UPDATE public."User"
       SET "currentWeddingId" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      accessUser.id,
      activeWedding.id,
    )
  }

  const response = NextResponse.json({
    success: true,
    authorized: true,
    user: {
      id: authUserId,
      accessUserId: accessUser.id,
      email,
      displayName: profile?.displayName ?? accessUser.name ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      role: dashboardRole,
      coupleId: accessUser.coupleId,
      activeWeddingId: activeWedding.id,
    },
    activeWedding: {
      ...activeWedding,
      date: activeWedding.date.toISOString(),
    },
    weddings: activeWeddings.map((wedding) => ({
      ...wedding,
      date: wedding.date.toISOString(),
    })),
    expiresAt: appSession.expiresAt,
  })

  if (activeWedding.id !== appSession.activeWeddingId) {
    setAppSessionCookie(response, {
      userId: accessUser.id,
      authUserId,
      email,
      role: dashboardRole,
      coupleId: accessUser.coupleId,
      activeWeddingId: activeWedding.id,
    })
  }

  return response
}

export async function GET(request: NextRequest) {
  try {
    const appSession = readAppSession(request)
    if (!appSession) return signedOutResponse()

    if (isCiPlannerE2EMode()) {
      const accessUser = await loadAccessUser(appSession.userId)
      if (!accessUser || !accessUserMatchesSession(accessUser, appSession)) {
        return signedOutResponse()
      }

      return authorizedResponse({
        appSession,
        accessUser,
        authUserId: appSession.authUserId,
        email: appSession.email.toLowerCase(),
        profile: null,
      })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user || user.id !== appSession.authUserId || !user.email) {
      return signedOutResponse()
    }

    const email = user.email.toLowerCase()
    const [accessUser, profile] = await Promise.all([
      loadAccessUser(appSession.userId),
      db.userProfile.findUnique({
        where: { id: user.id },
        select: {
          displayName: true,
          avatarUrl: true,
          isBanned: true,
        },
      }),
    ])

    if (
      !accessUser ||
      accessUser.email.toLowerCase() !== email ||
      !accessUserMatchesSession(accessUser, appSession) ||
      profile?.isBanned
    ) {
      await supabase.auth.signOut()
      return signedOutResponse()
    }

    return authorizedResponse({
      appSession,
      accessUser,
      authUserId: user.id,
      email,
      profile,
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json(
      { success: false, authorized: false, error: 'Failed to verify session.' },
      { status: 500 },
    )
  }
}
