import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import {
  clearAppSessionCookie,
  isDashboardRole,
  setAppSessionCookie,
} from '@/lib/app-session'
import {
  acceptPendingMemberships,
  listAccessibleWeddings,
} from '@/lib/wedding-access'

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

    const [accessUser, existingProfile] = await Promise.all([
      db.user.findUnique({
        where: { email },
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
        where: { id: data.user.id },
        select: {
          displayName: true,
          avatarUrl: true,
          isBanned: true,
        },
      }),
    ])

    if (
      !accessUser ||
      !accessUser.isActive ||
      !isDashboardRole(accessUser.role)
    ) {
      await supabase.auth.signOut()
      return errorResponse(
        'This account has not been assigned dashboard access.',
        403
      )
    }

    if (existingProfile?.isBanned) {
      await supabase.auth.signOut()
      return errorResponse('This account has been disabled.', 403)
    }

    await acceptPendingMemberships(accessUser.id)

    const weddings = await listAccessibleWeddings(accessUser.id, accessUser.role)
    if (weddings.length === 0) {
      await supabase.auth.signOut()
      return errorResponse(
        'This account is active but has not been assigned to a wedding.',
        403
      )
    }

    const currentWeddingRows = await db.$queryRawUnsafe<
      Array<{ currentWeddingId: string | null }>
    >(
      'SELECT "currentWeddingId" FROM public."User" WHERE id = $1 LIMIT 1',
      accessUser.id
    )

    const storedWeddingId = currentWeddingRows[0]?.currentWeddingId ?? null
    const activeWedding =
      weddings.find((wedding) => wedding.id === storedWeddingId) ?? weddings[0]

    await db.$executeRawUnsafe(
      `UPDATE public."User"
       SET "currentWeddingId" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      accessUser.id,
      activeWedding.id
    )

    const normalizedAuthEmail = data.user.email?.toLowerCase() ?? email
    const displayName = existingProfile?.displayName ?? accessUser.name ?? null

    await db.$transaction([
      db.user.update({
        where: { id: accessUser.id },
        data: { lastLoginAt: new Date() },
      }),
      db.userProfile.upsert({
        where: { id: data.user.id },
        create: {
          id: data.user.id,
          email: normalizedAuthEmail,
          displayName,
          role: accessUser.role,
          lastLoginAt: new Date(),
        },
        update: {
          email: normalizedAuthEmail,
          displayName,
          role: accessUser.role,
          lastLoginAt: new Date(),
        },
      }),
    ])

    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        accessUserId: accessUser.id,
        email: normalizedAuthEmail,
        displayName,
        role: accessUser.role,
        coupleId: accessUser.coupleId,
        activeWeddingId: activeWedding.id,
      },
      activeWedding: {
        ...activeWedding,
        date: activeWedding.date.toISOString(),
      },
      weddings: weddings.map((wedding) => ({
        ...wedding,
        date: wedding.date.toISOString(),
      })),
    })

    setAppSessionCookie(response, {
      userId: accessUser.id,
      authUserId: data.user.id,
      email: normalizedAuthEmail,
      role: accessUser.role,
      coupleId: accessUser.coupleId,
      activeWeddingId: activeWedding.id,
    })

    return response
  } catch (error) {
    console.error('[auth/signin] Error:', error)
    return errorResponse('Unable to sign in right now.', 500)
  }
}
