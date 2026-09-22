import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { updatePlannerTaskOperation } from '@/lib/planner-task-operations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const body = await request.json()
    const result = await updatePlannerTaskOperation(access.context.weddingId, id, body)
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, ...(result.field ? { field: result.field } : {}) },
        { status: result.status },
      )
    }
    return NextResponse.json({ success: true, data: result.value })
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
