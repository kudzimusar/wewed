import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTimelineFields } from '@/lib/planner-legacy-metadata'
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

interface PatchTimelinePayload {
  time?: string
  event?: string
  title?: string
  notes?: string | null
  description?: string | null
  duration?: string | null
  location?: string | null
  icon?: string | null
  order?: number
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'timeline.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.programmeItem.findFirst({
      where: { id, weddingId: access.context.weddingId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Timeline item not found' },
        { status: 404 },
      )
    }

    const body = (await request.json()) as PatchTimelinePayload
    const updates: Record<string, unknown> = {}

    if (body.time !== undefined) {
      const time = body.time.trim()
      if (!time) {
        return NextResponse.json(
          { success: false, error: 'Time cannot be empty' },
          { status: 400 },
        )
      }
      updates.time = time
    }
    if (body.event !== undefined || body.title !== undefined) {
      const title = (body.event ?? body.title ?? '').trim()
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Event title cannot be empty' },
          { status: 400 },
        )
      }
      updates.title = title
    }
    if (body.notes !== undefined || body.description !== undefined) {
      updates.description = (body.notes ?? body.description)?.trim() || null
    }
    if (body.order !== undefined) {
      if (typeof body.order !== 'number' || !Number.isFinite(body.order)) {
        return NextResponse.json(
          { success: false, error: 'order must be a number' },
          { status: 400 },
        )
      }
      updates.order = body.order
    }
    if (body.duration !== undefined) {
      updates.duration = body.duration?.trim() || null
    }
    if (body.location !== undefined) {
      updates.location = body.location?.trim() || null
    }
    if (body.icon !== undefined) {
      const icon = body.icon?.trim() || null
      updates.displayIcon = icon
      updates.icon = icon
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 },
      )
    }

    const updated = await db.programmeItem.update({
      where: { id: existing.id },
      data: updates,
    })
    return NextResponse.json({ success: true, data: formatProgrammeItem(updated) })
  } catch (error) {
    console.error('[PLANNER TIMELINE PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update timeline item' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'timeline.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.programmeItem.findFirst({
      where: { id, weddingId: access.context.weddingId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Timeline item not found' },
        { status: 404 },
      )
    }

    await db.programmeItem.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true, data: { id, deleted: true } })
  } catch (error) {
    console.error('[PLANNER TIMELINE DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete timeline item' },
      { status: 500 },
    )
  }
}
