import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { formatPlannerTask as formatTask } from '@/lib/planner-task-domain'
import { createPlannerTaskOperation } from '@/lib/planner-task-operations'

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

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = await request.json()
    const result = await createPlannerTaskOperation(access.context.weddingId, body)
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, ...(result.field ? { field: result.field } : {}) },
        { status: result.status },
      )
    }
    return NextResponse.json({ success: true, data: result.value }, { status: 201 })
  } catch (error) {
    console.error('[PLANNER TASKS POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create planner task' },
      { status: 500 },
    )
  }
}
