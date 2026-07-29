import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

const CATEGORIES = [
  'timeline_12_18',
  'timeline_9_12',
  'timeline_6_9',
  'timeline_3_6',
  'timeline_2mo',
  'timeline_1mo',
  'timeline_2wk',
  'timeline_1wk',
  'wedding_day',
  'spiritual',
  'venue',
  'catering',
  'attire',
  'roora',
  'magumo',
  'transport',
  'stationery',
  'decor',
  'photo_video',
  'music',
  'other',
] as const
const STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const

interface PatchTaskPayload {
  title?: string
  description?: string | null
  category?: string
  status?: string
  priority?: string
  dueDate?: string | null
  assignee?: string | null
  order?: number
}

function formatTask(task: {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  priority: string
  dueDate: Date | null
  assignee: string | null
  assigneeUserId: string | null
  order: number
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.plannerTask.findFirst({
      where: { id, weddingId: access.context.weddingId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 },
      )
    }

    const body = (await request.json()) as PatchTaskPayload
    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json(
          { success: false, error: 'Title cannot be empty' },
          { status: 400 },
        )
      }
      updates.title = body.title.trim()
    }
    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null
    }
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category as (typeof CATEGORIES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid category. Allowed: ${CATEGORIES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.category = body.category
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Allowed: ${STATUSES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.status = body.status
    }
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid priority. Allowed: ${PRIORITIES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.priority = body.priority
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate === null || body.dueDate === '') {
        updates.dueDate = null
      } else {
        const parsed = new Date(body.dueDate)
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            { success: false, error: 'Invalid dueDate' },
            { status: 400 },
          )
        }
        updates.dueDate = parsed
      }
    }
    if (body.assignee !== undefined) {
      // This remains the original free-text planning label. Team ownership is
      // stored separately in assigneeUserId by the collaboration assignment.
      updates.assignee = body.assignee?.trim() || null
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 },
      )
    }

    const updated = await db.plannerTask.update({
      where: { id: existing.id },
      data: updates,
    })

    return NextResponse.json({ success: true, data: formatTask(updated) })
  } catch (error) {
    console.error('[PLANNER TASK PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.plannerTask.findFirst({
      where: { id, weddingId: access.context.weddingId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 },
      )
    }

    await db.plannerTask.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true, data: { id, deleted: true } })
  } catch (error) {
    console.error('[PLANNER TASK DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete task' },
      { status: 500 },
    )
  }
}
