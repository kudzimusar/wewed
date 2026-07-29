import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  clearAppSessionCookie,
  isDashboardRole,
  readAppSession,
} from '@/lib/app-session'

const FLAGSHIP_WEDDING_SLUG = 'charity-and-kudzie'

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

    if (error || !user || user.id !== appSession.userId || !user.email) {
      return signedOutResponse()
    }

    const email = user.email.toLowerCase()
    const [accessUser, profile, flagshipWedding] = await Promise.all([
      db.user.findUnique({
        where: { email },
        select: {
          id: true,
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
      db.wedding.findUnique({
        where: { slug: FLAGSHIP_WEDDING_SLUG },
        select: { coupleId: true },
      }),
    ])

    if (
      !accessUser ||
      !accessUser.isActive ||
      !isDashboardRole(accessUser.role) ||
      profile?.isBanned ||
      accessUser.role !== appSession.role ||
      accessUser.coupleId !== appSession.coupleId ||
      (accessUser.role !== 'admin' &&
        (!flagshipWedding || accessUser.coupleId !== flagshipWedding.coupleId))
    ) {
      await supabase.auth.signOut()
      return signedOutResponse()
    }

    return NextResponse.json({
      success: true,
      authorized: true,
      user: {
        id: user.id,
        email,
        displayName: profile?.displayName ?? accessUser.name ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        role: accessUser.role,
        coupleId: accessUser.coupleId,
      },
      expiresAt: appSession.expiresAt,
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json(
      { success: false, authorized: false, error: 'Failed to verify session.' },
      { status: 500 }
    )
  }
}
