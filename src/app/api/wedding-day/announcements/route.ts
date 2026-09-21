import { NextRequest, NextResponse } from 'next/server'
import {
  activeAnnouncements,
  createWeddingAnnouncement,
  readWeddingDayGuestContext,
  readWeddingDayOperator,
  requireWeddingDayOperator,
} from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const guest = await readWeddingDayGuestContext(request)
  if (guest) {
    return NextResponse.json({ success: true, data: guest.announcements })
  }

  const actor = await readWeddingDayOperator(request)
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }
  const audience = actor.role === 'vendor' ? 'vendor' : actor.role === 'planner' ? 'planner' : 'all'
  const data = await activeAnnouncements(actor.weddingId, audience)
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const actor = await requireWeddingDayOperator(request, ['planner', 'couple', 'admin'])
  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Forbidden — announcement publishing authority required.' },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | {
        audience?: 'all' | 'guest' | 'planner' | 'vendor'
        title?: string | null
        body?: string
        expiresAt?: string | null
      }
    | null
  const message = body?.body?.trim()
  if (!message) {
    return NextResponse.json({ success: false, error: 'Announcement body is required.' }, { status: 400 })
  }
  const audience = body?.audience ?? 'all'
  if (!['all', 'guest', 'planner', 'vendor'].includes(audience)) {
    return NextResponse.json({ success: false, error: 'Invalid announcement audience.' }, { status: 400 })
  }
  let expiresAt: Date | null = null
  if (body?.expiresAt) {
    expiresAt = new Date(body.expiresAt)
    if (Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid expiresAt value.' }, { status: 400 })
    }
  }

  const data = await createWeddingAnnouncement({
    weddingId: actor.weddingId,
    authorUserId: actor.userId,
    audience,
    title: body?.title,
    body: message,
    expiresAt,
  })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
