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

    if (error || !user || user.id !== appSession.userId) {
      return signedOutResponse()
    }

    const [profile, flagshipWedding] = await Promise.all([
      db.userProfile.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          coupleId: true,
          isBanned: true,
        },
      }),
      db.wedding.findUnique({
        where: { slug: FLAGSHIP_WEDDING_SLUG },
        select: { coupleId: true },
      }),
    ])

    if (
      !profile ||
      profile.isBanned ||
      !isDashboardRole(profile.role) ||
      profile.role !== appSession.role ||
      profile.coupleId !== appSession.coupleId ||
      (profile.role !== 'admin' &&
        (!flagshipWedding || profile.coupleId !== flagshipWedding.coupleId))
    ) {
      await supabase.auth.signOut()
      return signedOutResponse()
    }

    return NextResponse.json({
      success: true,
      authorized: true,
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
        coupleId: profile.coupleId,
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
