import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readWeddingDayGuestContext } from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Promotion is reviewable independently of migration/key activation.
  if (process.env.WEDDING_DAY_GUEST_API_ENABLED !== 'true') {
    return NextResponse.json({ success: false, code: 'WEDDING_DAY_NOT_ENABLED' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
  try {
  const context = await readWeddingDayGuestContext(request)
  if (!context) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized guest session.' },
      { status: 401 },
    )
  }

  const programme = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, time, title, description, location, "order"
       FROM public."ProgrammeItem"
      WHERE "weddingId" = $1
      ORDER BY "order" ASC, id ASC`,
    context.wedding.id,
  )

  return NextResponse.json(
    {
      success: true,
      data: {
        ...context,
        programme,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
  } catch (error) {
    const attendance = error instanceof Error && error.message === 'ATTENDANCE_REQUIRED'
    return NextResponse.json({ success: false, code: attendance ? 'ATTENDANCE_REQUIRED' : 'WEDDING_DAY_UNAVAILABLE' },
      { status: attendance ? 409 : 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
