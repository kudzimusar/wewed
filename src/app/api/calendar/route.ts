import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { calendarCategorySchema } from '@/lib/calendar/contracts'
import { listCalendarItemsForSession } from '@/lib/calendar/service'

function parseDate(value: string | null) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid calendar date: ${value}`)
  return date
}

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const rawCategories = params.getAll('category')
    const categories = rawCategories.length
      ? rawCategories.map((value) => calendarCategorySchema.parse(value))
      : undefined
    const rawLimit = Number(params.get('limit') ?? 500)
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(1000, Math.trunc(rawLimit))) : 500

    const items = await listCalendarItemsForSession(session, {
      from: parseDate(params.get('from')),
      to: parseDate(params.get('to')),
      weddingId: params.get('weddingId')?.trim() || undefined,
      categories,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: items.map((item) => ({
        ...item,
        startAt: item.startAt.toISOString(),
        endAt: item.endAt?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error('[calendar GET] Error:', error)
    const message = error instanceof Error ? error.message : 'Unable to load calendar.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
