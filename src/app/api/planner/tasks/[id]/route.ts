import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import {
  formatPlannerTask as formatTask,
  isValidTaskCategory,
  isValidTaskPriority,
  isValidTaskStatus,
  PLANNER_TASK_CATEGORIES as CATEGORIES,
  PLANNER_TASK_PRIORITIES as PRIORITIES,
  PLANNER_TASK_STATUSES as STATUSES,
} from '@/lib/planner-task-domain'

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
      const titleError = plannerTitleError(body.title)
      if (titleError) {
        return NextResponse.json({ success: false, error: titleError, field: 'title' }, { status: 400 })
      }
      updates.title = normalizePlannerTitle(body.title)
    }
    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null
    }
    if (body.category !== undefined) {
      if (!isValidTaskCategory(body.category)) {
        return NextResponse.json(
          { success: false, error: `Invalid category. Allowed: ${CATEGORIES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.category = body.category
    }
    if (body.status !== undefined) {
      if (!isValidTaskStatus(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Allowed: ${STATUSES.join(', ')}` },
          { status: 400 },
        )
      }
      updates.status = body.status
    }
    if (body.priority !== undefined) {
      if (!isValidTaskPriority(body.priority)) {
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
