import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readWeddingDayGuestContext } from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
}
