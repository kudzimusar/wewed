import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  clearAppSessionCookie,
  isDashboardRole,
  readAppSession,
  setAppSessionCookie,
} from '@/lib/app-session'
import {
  acceptPendingMemberships,
  listAccessibleWeddings,
} from '@/lib/wedding-access'

function signedOutResponse() {
  const response = NextResponse.json({
    success: true,
    authorized: false,
    user: null,
  })
  clearAppSessionCookie(response)
  return response
}

export async function GET(request: NextRequest) {
  try {
    const appSession = readAppSession(request)
    if (!appSession) return signedOutResponse()

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
      db.user.findUnique({
        where: { id: appSession.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          coupleId: true,
          isActive: true,
        },
      }),
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
      !accessUser.isActive ||
      !isDashboardRole(accessUser.role) ||
      profile?.isBanned ||
      accessUser.role !== appSession.role ||
      accessUser.coupleId !== appSession.coupleId
    ) {
      await supabase.auth.signOut()
      return signedOutResponse()
    }

    await acceptPendingMemberships(accessUser.id)
    const weddings = await listAccessibleWeddings(accessUser.id, accessUser.role)
    const activeWeddings = weddings.filter(
      (wedding) => wedding.membershipStatus === 'active'
    )

    if (activeWeddings.length === 0) {
      await supabase.auth.signOut()
      return signedOutResponse()
    }

    const activeWedding =
      activeWeddings.find(
        (wedding) => wedding.id === appSession.activeWeddingId
      ) ?? activeWeddings[0]

    if (activeWedding.id !== appSession.activeWeddingId) {
      await db.$executeRawUnsafe(
        `UPDATE public."User"
         SET "currentWeddingId" = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        accessUser.id,
        activeWedding.id
      )
    }

    const response = NextResponse.json({
      success: true,
      authorized: true,
      user: {
        id: user.id,
        accessUserId: accessUser.id,
        email,
        displayName: profile?.displayName ?? accessUser.name ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        role: accessUser.role,
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
        authUserId: user.id,
        email,
        role: accessUser.role,
        coupleId: accessUser.coupleId,
        activeWeddingId: activeWedding.id,
      })
    }

    return response
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json(
      { success: false, authorized: false, error: 'Failed to verify session.' },
      { status: 500 }
    )
  }
}
