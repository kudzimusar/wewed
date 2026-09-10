import { NextRequest, NextResponse } from 'next/server'
import { createAppSessionToken, readBearerAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { listAccessibleWeddings } from '@/lib/wedding-access'

export async function POST(request: NextRequest) {
  const session = readBearerAppSession(request)
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    )
  }

  const body = (await request.json().catch(() => null)) as { weddingId?: unknown } | null
  const weddingId = typeof body?.weddingId === 'string' ? body.weddingId.trim() : ''
  if (!weddingId) {
    return NextResponse.json(
      { success: false, error: 'Wedding is required.' },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    )
  }

  const weddings = await listAccessibleWeddings(session.userId, session.role)
  const activeWedding = weddings.find(
    (wedding) => wedding.id === weddingId && wedding.membershipStatus === 'active',
  )
  if (!activeWedding) {
    return NextResponse.json(
      { success: false, error: 'Wedding access is unavailable or has been revoked.' },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    )
  }

  await db.user.update({
    where: { id: session.userId },
    data: { currentWeddingId: activeWedding.id },
  })

  const sessionToken = createAppSessionToken({
    userId: session.userId,
    authUserId: session.authUserId,
    email: session.email,
    role: session.role,
    coupleId: session.coupleId,
    activeWeddingId: activeWedding.id,
  })

  return NextResponse.json(
    { success: true, activeWedding, sessionToken },
    { headers: { 'cache-control': 'no-store' } },
  )
}
