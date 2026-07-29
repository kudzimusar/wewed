import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface TimelineMeta {
  d?: string
  l?: string
  i?: string
}

function encodeTimelineIcon(meta: TimelineMeta): string | null {
  const d = meta.d?.trim() || ''
  const l = meta.l?.trim() || ''
  const i = meta.i?.trim() || ''
  if (!d && !l && !i) return null
  return JSON.stringify({ ...(d ? { d } : {}), ...(l ? { l } : {}), ...(i ? { i } : {}) })
}

function decodeTimelineIcon(icon: string | null): {
  duration: string
  location: string
  icon?: string
} {
  if (!icon) return { duration: '', location: '' }
  if (icon.startsWith('{')) {
    try {
      const blob = JSON.parse(icon) as TimelineMeta
      return { duration: blob.d ?? '', location: blob.l ?? '', icon: blob.i }
    } catch {
      // Fall through to legacy icon-name handling.
    }
  }
  return { duration: '', location: '', icon }
}

function formatProgrammeItem(item: {
  id: string
  time: string
  title: string
  description: string | null
  icon: string | null
  order: number
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  const meta = decodeTimelineIcon(item.icon)
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
      orderBy: [{ order: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      count: items.length,
      data: items.map(formatProgrammeItem),
    })
  } catch (error) {
    console.error('[PLANNER TIMELINE GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch timeline' },
      { status: 500 }
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
        { status: 400 }
      )
    }
    if (!time) {
      return NextResponse.json(
        { success: false, error: 'Time is required' },
        { status: 400 }
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

    const created = await db.programmeItem.create({
      data: {
        time,
        title,
        description: (body.notes ?? body.description ?? '').trim() || null,
        icon: encodeTimelineIcon({
          d: body.duration,
          l: body.location,
          i: body.icon,
        }),
        order,
        weddingId: access.context.weddingId,
      },
    })

    return NextResponse.json(
      { success: true, data: formatProgrammeItem(created) },
      { status: 201 }
    )
  } catch (error) {
    console.error('[PLANNER TIMELINE POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create timeline item' },
      { status: 500 }
    )
  }
}
