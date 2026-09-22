import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import {
  formatPlannerTask as formatTask,
  normalizeTaskCategory,
  normalizeTaskPriority,
  normalizeTaskStatus,
} from '@/lib/planner-task-domain'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const tasks = await db.plannerTask.findMany({
      where: { weddingId: access.context.weddingId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasks.map(formatTask),
    })
  } catch (error) {
    console.error('[PLANNER TASKS GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch planner tasks' },
      { status: 500 },
    )
  }
}

interface CreateTaskPayload {
  title?: string
  description?: string
  category?: string
  status?: string
  priority?: string
  dueDate?: string | null
  assignee?: string
  order?: number
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as CreateTaskPayload
    const titleError = plannerTitleError(body.title)
    if (titleError) {
      return NextResponse.json({ success: false, error: titleError, field: 'title' }, { status: 400 })
    }

    const category = normalizeTaskCategory(body.category)
    const status = normalizeTaskStatus(body.status)
    const priority = normalizeTaskPriority(body.priority)

    let dueDate: Date | null = null
    if (body.dueDate) {
      const parsed = new Date(body.dueDate)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid dueDate' },
          { status: 400 },
        )
      }
      dueDate = parsed
    }

    let order = body.order
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      const lastTask = await db.plannerTask.findFirst({
        where: { weddingId: access.context.weddingId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      order = (lastTask?.order ?? 0) + 1
    }

    const task = await db.plannerTask.create({
      data: {
        title: normalizePlannerTitle(body.title),
        description: body.description?.trim() || null,
        category,
        status,
        priority,
        dueDate,
        assignee: body.assignee?.trim() || null,
        order,
        weddingId: access.context.weddingId,
      },
    })

    return NextResponse.json(
      { success: true, data: formatTask(task) },
      { status: 201 },
    )
  } catch (error) {
    console.error('[PLANNER TASKS POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create planner task' },
      { status: 500 },
    )
  }
}
