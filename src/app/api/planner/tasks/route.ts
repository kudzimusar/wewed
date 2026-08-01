import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'

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

type Category = (typeof CATEGORIES)[number]
type Status = (typeof STATUSES)[number]
type Priority = (typeof PRIORITIES)[number]

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

    const category: Category = CATEGORIES.includes(body.category as Category)
      ? (body.category as Category)
      : 'other'
    const status: Status = STATUSES.includes(body.status as Status)
      ? (body.status as Status)
      : 'todo'
    const priority: Priority = PRIORITIES.includes(body.priority as Priority)
      ? (body.priority as Priority)
      : 'medium'

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
