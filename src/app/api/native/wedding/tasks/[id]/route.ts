import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import {
  formatPlannerTask,
  isValidTaskCategory,
  isValidTaskPriority,
  isValidTaskStatus,
} from '@/lib/planner-task-domain'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import { shouldBlockPreviewWrite, PREVIEW_WRITE_BLOCK_MESSAGE } from '@/lib/preview-write-safety'

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

/**
 * Master plan Phase 8 §9 — one task, scoped to the freshly-resolved grant's wedding, never to a
 * client-supplied weddingId. Native `toggleTask(weddingId, taskId)` is a `status` PATCH through
 * this same route — there is no separate toggle endpoint, matching "do not implement a separate
 * native task schema" (§9).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'planner.edit')
  if (!permission.ok) return permission.response

  if (shouldBlockPreviewWrite({ method: request.method, weddingId: scope.weddingId })) {
    return noStoreJson({ success: false, code: 'PREVIEW_WRITE_BLOCKED', error: PREVIEW_WRITE_BLOCK_MESSAGE }, 423)
  }

  const { id } = await params
  const existing = await db.plannerTask.findFirst({ where: { id, weddingId: scope.weddingId } })
  if (!existing) return noStoreJson({ success: false, error: 'Task not found' }, 404)

  const body = (await request.json().catch(() => null)) as PatchTaskPayload | null
  if (!body) return noStoreJson({ success: false, error: 'A valid JSON body is required.' }, 400)

  const updates: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const titleError = plannerTitleError(body.title)
    if (titleError) return noStoreJson({ success: false, error: titleError, field: 'title' }, 400)
    updates.title = normalizePlannerTitle(body.title)
  }
  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.category !== undefined) {
    if (!isValidTaskCategory(body.category)) return noStoreJson({ success: false, error: 'Invalid category.' }, 400)
    updates.category = body.category
  }
  if (body.status !== undefined) {
    if (!isValidTaskStatus(body.status)) return noStoreJson({ success: false, error: 'Invalid status.' }, 400)
    updates.status = body.status
  }
  if (body.priority !== undefined) {
    if (!isValidTaskPriority(body.priority)) return noStoreJson({ success: false, error: 'Invalid priority.' }, 400)
    updates.priority = body.priority
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      updates.dueDate = null
    } else {
      const parsed = new Date(body.dueDate)
      if (Number.isNaN(parsed.getTime())) return noStoreJson({ success: false, error: 'Invalid dueDate' }, 400)
      updates.dueDate = parsed
    }
  }
  if (body.assignee !== undefined) updates.assignee = body.assignee?.trim() || null
  if (body.order !== undefined) {
    if (typeof body.order !== 'number' || !Number.isFinite(body.order)) {
      return noStoreJson({ success: false, error: 'order must be a number' }, 400)
    }
    updates.order = body.order
  }

  if (Object.keys(updates).length === 0) {
    return noStoreJson({ success: false, error: 'No updates provided' }, 400)
  }

  const updated = await db.plannerTask.update({ where: { id: existing.id }, data: updates })
  return noStoreJson({ success: true, data: formatPlannerTask(updated) })
}
