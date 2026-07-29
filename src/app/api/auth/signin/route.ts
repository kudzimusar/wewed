import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  clearAppSessionCookie,
  isDashboardRole,
  setAppSessionCookie,
} from '@/lib/app-session'

const FLAGSHIP_WEDDING_SLUG = 'charity-and-kudzie'

function errorResponse(message: string, status: number) {
  const response = NextResponse.json(
    { success: false, error: message },
    { status }
  )
  clearAppSessionCookie(response)
  return response
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: unknown
      password?: unknown
    }

    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return errorResponse('Email and password are required.', 400)
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      return errorResponse('Invalid email or password.', 401)
    }

    const [profile, flagshipWedding] = await Promise.all([
      db.userProfile.findUnique({
        where: { id: data.user.id },
        select: {
          id: true,
          email: true,
          displayName: true,
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

    if (!profile || !isDashboardRole(profile.role)) {
      await supabase.auth.signOut()
      return errorResponse(
        'This account has not been assigned dashboard access.',
        403
      )
    }

    if (profile.isBanned) {
      await supabase.auth.signOut()
      return errorResponse('This account has been disabled.', 403)
    }

    if (
      profile.role !== 'admin' &&
      (!flagshipWedding || profile.coupleId !== flagshipWedding.coupleId)
    ) {
      await supabase.auth.signOut()
      return errorResponse(
        'This account is not assigned to the current wedding.',
        403
      )
    }

    await db.userProfile.update({
      where: { id: profile.id },
      data: {
        email: data.user.email?.toLowerCase() ?? profile.email,
        lastLoginAt: new Date(),
      },
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: data.user.email ?? profile.email,
        displayName: profile.displayName,
        role: profile.role,
        coupleId: profile.coupleId,
      },
    })

    setAppSessionCookie(response, {
      userId: profile.id,
      email: data.user.email ?? profile.email,
      role: profile.role,
      coupleId: profile.coupleId,
    })

    return response
  } catch (error) {
    console.error('[auth/signin] Error:', error)
    return errorResponse('Unable to sign in right now.', 500)
  }
}
