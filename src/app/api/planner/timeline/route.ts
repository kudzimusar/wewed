import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTimelineFields } from '@/lib/planner-legacy-metadata'
import { sortTimelineItems, timelineMinutes } from '@/lib/planner-timeline-order'
import { requireWeddingPermission } from '@/lib/wedding-access'

function formatProgrammeItem(item: {
  id: string
  time: string
  title: string
  description: string | null
  icon: string | null
  duration: string | null
  location: string | null
  displayIcon: string | null
  order: number
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  const meta = resolveTimelineFields(item)
  return {
    id: item.id,
    time: item.time,
    event: item.title,
    title: item.title,
    description: item.description,
    notes: item.description ?? '',
    duration: meta.duration,
    location: meta.location,
    icon: meta.icon,
    order: item.order,
    weddingId: item.weddingId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'timeline.view')
  if (access.error) return access.error

  try {
    const items = await db.programmeItem.findMany({
      where: { weddingId: access.context.weddingId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    const chronologicalItems = sortTimelineItems(items)

    return NextResponse.json({
      success: true,
      count: chronologicalItems.length,
      data: chronologicalItems.map((item, index) => ({
        ...formatProgrammeItem(item),
        // Presentation order is derived from clock time. The persisted order is
        // retained only as a stable tie-breaker for simultaneous events.
        order: index + 1,
      })),
    })
  } catch (error) {
    console.error('[PLANNER TIMELINE GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch timeline' },
      { status: 500 },
    )
  }
}

interface CreateTimelinePayload {
  time?: string
  event?: string
  title?: string
  notes?: string
  description?: string
  duration?: string
  location?: string
  icon?: string
  order?: number
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'timeline.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as CreateTimelinePayload
    const title = (body.event ?? body.title ?? '').trim()
    const time = (body.time ?? '').trim()

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Event title is required' },
        { status: 400 },
      )
    }
    if (!time) {
      return NextResponse.json(
        { success: false, error: 'Time is required' },
        { status: 400 },
      )
    }
    if (timelineMinutes(time) === null) {
      return NextResponse.json(
        { success: false, error: 'Time must be a valid clock time.' },
        { status: 400 },
      )
    }

    let order = body.order
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      const last = await db.programmeItem.findFirst({
        where: { weddingId: access.context.weddingId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      order = (last?.order ?? 0) + 1
    }

    const displayIcon = body.icon?.trim() || null
    const created = await db.programmeItem.create({
      data: {
        time,
        title,
        description: (body.notes ?? body.description ?? '').trim() || null,
        icon: displayIcon,
        duration: body.duration?.trim() || null,
        location: body.location?.trim() || null,
        displayIcon,
        order,
        weddingId: access.context.weddingId,
      },
    })

    return NextResponse.json(
      { success: true, data: formatProgrammeItem(created) },
      { status: 201 },
    )
  } catch (error) {
    console.error('[PLANNER TIMELINE POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create timeline item' },
      { status: 500 },
    )
  }
}
