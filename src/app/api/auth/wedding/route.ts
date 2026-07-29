import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession, setAppSessionCookie } from '@/lib/app-session'
import { listAccessibleWeddings } from '@/lib/wedding-access'

export async function POST(request: NextRequest) {
  try {
    const session = readAppSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sign in is required.' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as { weddingId?: unknown }
    const weddingId =
      typeof body.weddingId === 'string' ? body.weddingId.trim() : ''

    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'weddingId is required.' },
        { status: 400 }
      )
    }

    const weddings = await listAccessibleWeddings(session.userId, session.role)
    const wedding = weddings.find(
      (candidate) =>
        candidate.id === weddingId && candidate.membershipStatus === 'active'
    )

    if (!wedding) {
      return NextResponse.json(
        { success: false, error: 'Wedding access was not found or is inactive.' },
        { status: 403 }
      )
    }

    await db.$executeRawUnsafe(
      `UPDATE public."User"
       SET "currentWeddingId" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      session.userId,
      wedding.id
    )

    const response = NextResponse.json({
      success: true,
      activeWedding: {
        ...wedding,
        date: wedding.date.toISOString(),
      },
    })

    setAppSessionCookie(response, {
      userId: session.userId,
      authUserId: session.authUserId,
      email: session.email,
      role: session.role,
      coupleId: session.coupleId,
      activeWeddingId: wedding.id,
    })

    return response
  } catch (error) {
    console.error('[auth/wedding] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to switch weddings.' },
      { status: 500 }
    )
  }
}
