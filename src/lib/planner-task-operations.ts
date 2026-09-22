/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §5.
 *
 * The ONE shared server-domain operation for mutating a `PlannerTask`. Both
 * `/api/planner/tasks*` (cookie session) and `/api/native/wedding/tasks*` (bearer session) call
 * these functions — neither route re-implements validation, ordering, or the create/update
 * transaction itself. Every caller has ALREADY resolved `weddingId` from its own authoritative
 * source (the PWA's `requireWeddingPermission` cookie context; the native routes'
 * `resolveNativeGrantContext` fresh grant) before calling in — this module never re-derives
 * authorization, only domain behavior, so callers keep their own transport-appropriate
 * authorization and response shape.
 */

import { db } from '@/lib/db'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import {
  formatPlannerTask,
  isValidTaskCategory,
  isValidTaskPriority,
  isValidTaskStatus,
  normalizeTaskCategory,
  normalizeTaskPriority,
  normalizeTaskStatus,
  PLANNER_TASK_CATEGORIES,
  PLANNER_TASK_PRIORITIES,
  PLANNER_TASK_STATUSES,
  type PlannerTaskRow,
} from '@/lib/planner-task-domain'

export interface CreatePlannerTaskInput {
  title?: unknown
  description?: unknown
  category?: unknown
  status?: unknown
  priority?: unknown
  dueDate?: unknown
  assignee?: unknown
  order?: unknown
}

export interface UpdatePlannerTaskInput {
  title?: unknown
  description?: unknown
  category?: unknown
  status?: unknown
  priority?: unknown
  dueDate?: unknown
  assignee?: unknown
  order?: unknown
}

export type PlannerTaskOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; field?: string }

function parseDueDate(value: unknown): { ok: true; value: Date | null } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { ok: false }
  return { ok: true, value: parsed }
}

export async function createPlannerTaskOperation(
  weddingId: string,
  input: CreatePlannerTaskInput,
): Promise<PlannerTaskOperationResult<ReturnType<typeof formatPlannerTask>>> {
  const titleError = plannerTitleError(input.title as string | undefined)
  if (titleError) return { ok: false, status: 400, error: titleError, field: 'title' }

  const dueDate = parseDueDate(input.dueDate)
  if (!dueDate.ok) return { ok: false, status: 400, error: 'Invalid dueDate' }

  let order = typeof input.order === 'number' && Number.isFinite(input.order) ? input.order : undefined
  if (order === undefined) {
    const lastTask = await db.plannerTask.findFirst({
      where: { weddingId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    order = (lastTask?.order ?? 0) + 1
  }

  const task = await db.plannerTask.create({
    data: {
      title: normalizePlannerTitle(input.title as string | undefined),
      description: typeof input.description === 'string' ? input.description.trim() || null : null,
      category: normalizeTaskCategory(input.category),
      status: normalizeTaskStatus(input.status),
      priority: normalizeTaskPriority(input.priority),
      dueDate: dueDate.value,
      assignee: typeof input.assignee === 'string' ? input.assignee.trim() || null : null,
      order,
      weddingId,
    },
  })

  return { ok: true, value: formatPlannerTask(task) }
}

export async function updatePlannerTaskOperation(
  weddingId: string,
  taskId: string,
  input: UpdatePlannerTaskInput,
): Promise<PlannerTaskOperationResult<ReturnType<typeof formatPlannerTask>>> {
  const existing = await db.plannerTask.findFirst({ where: { id: taskId, weddingId } })
  if (!existing) return { ok: false, status: 404, error: 'Task not found' }

  const updates: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const titleError = plannerTitleError(input.title as string | undefined)
    if (titleError) return { ok: false, status: 400, error: titleError, field: 'title' }
    updates.title = normalizePlannerTitle(input.title as string | undefined)
  }
  if (input.description !== undefined) {
    updates.description = typeof input.description === 'string' ? input.description.trim() || null : null
  }
  if (input.category !== undefined) {
    if (!isValidTaskCategory(input.category)) {
      return { ok: false, status: 400, error: `Invalid category. Allowed: ${PLANNER_TASK_CATEGORIES.join(', ')}` }
    }
    updates.category = input.category
  }
  if (input.status !== undefined) {
    if (!isValidTaskStatus(input.status)) {
      return { ok: false, status: 400, error: `Invalid status. Allowed: ${PLANNER_TASK_STATUSES.join(', ')}` }
    }
    updates.status = input.status
  }
  if (input.priority !== undefined) {
    if (!isValidTaskPriority(input.priority)) {
      return { ok: false, status: 400, error: `Invalid priority. Allowed: ${PLANNER_TASK_PRIORITIES.join(', ')}` }
    }
    updates.priority = input.priority
  }
  if (input.dueDate !== undefined) {
    const dueDate = parseDueDate(input.dueDate)
    if (!dueDate.ok) return { ok: false, status: 400, error: 'Invalid dueDate' }
    updates.dueDate = dueDate.value
  }
  if (input.assignee !== undefined) {
    // The original free-text planning label. Team ownership is stored separately in assigneeUserId by the collaboration assignment, and is never touched here.
    updates.assignee = typeof input.assignee === 'string' ? input.assignee.trim() || null : null
  }
  if (input.order !== undefined) {
    if (typeof input.order !== 'number' || !Number.isFinite(input.order)) {
      return { ok: false, status: 400, error: 'order must be a number' }
    }
    updates.order = input.order
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, status: 400, error: 'No updates provided' }
  }

  const updated = await db.plannerTask.update({ where: { id: existing.id }, data: updates })
  return { ok: true, value: formatPlannerTask(updated) }
}

/** `toggleTask` (native's done<->todo shortcut) is `updatePlannerTaskOperation` with a derived status. */
export async function togglePlannerTaskOperation(
  weddingId: string,
  taskId: string,
): Promise<PlannerTaskOperationResult<ReturnType<typeof formatPlannerTask>>> {
  const existing = await db.plannerTask.findFirst({ where: { id: taskId, weddingId } })
  if (!existing) return { ok: false, status: 404, error: 'Task not found' }
  const nextStatus = existing.status === 'done' ? 'todo' : 'done'
  return updatePlannerTaskOperation(weddingId, taskId, { status: nextStatus })
}

export type { PlannerTaskRow }
